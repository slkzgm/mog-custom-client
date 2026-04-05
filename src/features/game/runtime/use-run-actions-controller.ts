import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react";

import { ApiError } from "../../../lib/http/api-error";
import { gameActionQueue } from "../../realtime/game-action-queue";
import {
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  findPortalAtPosition,
  getMoveTarget,
  isAttackableEnemy,
  isMoveTargetPassable,
} from "../game-map";
import { getRunModeDefinition, getRunModeRewardKey, getRunModeRewardValue } from "../game-modes";
import type { GameStateSnapshot, MoveDirection } from "../game.types";
import { useRunMoveMutation } from "../use-run-move-mutation";
import { useRunRerollMutation } from "../use-run-reroll-mutation";
import { useSelectUpgradeMutation } from "../use-select-upgrade-mutation";
import { useRunTeleportMutation } from "../use-run-teleport-mutation";
import type { RunSessionController } from "./use-run-session-controller";

interface RunQueuedActionParams {
  queuedState: GameStateSnapshot;
  queuedRunId: string;
}

type BufferedGameplayInput =
  | { kind: "move"; direction: MoveDirection }
  | { kind: "pass" };

export function useRunActionsController(
  runSession: Pick<
    RunSessionController,
    | "activeRunId"
    | "effectiveGameState"
    | "runtimeState"
    | "recoverRunStateFromServer"
    | "moveRunId"
    | "hasPendingUpgradeSelection"
    | "hasEnoughTreasureForReroll"
    | "nextRerollCost"
    | "canEstimateNextRerollCost"
    | "pendingUpgradeOptions"
    | "isRefreshDisabled"
  >,
) {
  const runMoveMutation = useRunMoveMutation();
  const runTeleportMutation = useRunTeleportMutation();
  const runRerollMutation = useRunRerollMutation();
  const selectUpgradeMutation = useSelectUpgradeMutation();
  const runType = runSession.effectiveGameState?.runType ?? "NORMAL";
  const rewardLabel = getRunModeDefinition(runType).rewardLabel.toLowerCase();
  const bufferedInputRef = useRef<BufferedGameplayInput | null>(null);

  const isAnyActionPending =
    runMoveMutation.isPending || runTeleportMutation.isPending || runRerollMutation.isPending || selectUpgradeMutation.isPending;
  const rerollValidationError = !runSession.moveRunId
    ? "No active run id."
    : !runSession.hasPendingUpgradeSelection
      ? "No pending upgrade selection."
      : !runSession.canEstimateNextRerollCost
        ? "Unable to estimate next reroll cost."
        : !runSession.hasEnoughTreasureForReroll
          ? `Insufficient ${rewardLabel} for reroll (need ${runSession.nextRerollCost}, have ${
              getRunModeRewardValue(runType, runSession.effectiveGameState?.player) ?? 0
            }).`
          : null;
  const isRerollDisabled =
    Boolean(rerollValidationError) || runRerollMutation.isPending || selectUpgradeMutation.isPending;

  const runQueuedRuntimeAction = useCallback(
    async (actionName: string, execute: (params: RunQueuedActionParams) => Promise<void>) => {
      const { localGameStateRef } = runSession.runtimeState;
      if (localGameStateRef.current?.runId !== runSession.effectiveGameState?.runId) {
        localGameStateRef.current = runSession.effectiveGameState;
      }

      const fallbackRunId = localGameStateRef.current?.runId ?? runSession.activeRunId;

      await gameActionQueue.enqueue(async () => {
        const queuedState = localGameStateRef.current;
        const queuedRunId = queuedState?.runId ?? runSession.activeRunId;
        if (!queuedState || !queuedRunId) return;
        if ((queuedState.pendingUpgradeOptions?.length ?? 0) > 0) return;

        const startedAtMs = performance.now();
        await execute({
          queuedState,
          queuedRunId,
        });
        runSession.runtimeState.recordActionMetrics(actionName, startedAtMs);
      }).catch(async (error: unknown) => {
        if (error instanceof ApiError && error.code === "INTERNAL_ERROR" && fallbackRunId) {
          await runSession.recoverRunStateFromServer(fallbackRunId);
        }
      });
    },
    [runSession],
  );

  const findDirectionalPortalTarget = useCallback(
    (gameState: GameStateSnapshot, direction: MoveDirection) => {
      const player = gameState.player;
      if (!player) return null;

      const currentPortal = findPortalAtPosition(gameState, player.x, player.y);
      if (!currentPortal) return null;

      const target = getMoveTarget(gameState, direction);
      if (!target) return null;

      const targetPortal = findPortalAtPosition(gameState, target.targetX, target.targetY);
      if (!targetPortal) return null;

      const latestPortalPrompt = runSession.runtimeState.portalPrompt;
      if (!latestPortalPrompt) return null;

      return latestPortalPrompt.portalX === target.targetX && latestPortalPrompt.portalY === target.targetY ? targetPortal : null;
    },
    [runSession.runtimeState.portalPrompt],
  );

  const validateMove = useCallback(
    (direction: MoveDirection): string | null => {
      if (!runSession.moveRunId) return "No active run id.";
      if (!runSession.effectiveGameState) return "No run gameState loaded yet.";
      if (runSession.hasPendingUpgradeSelection) return "Upgrade selection is pending.";

      const target = getMoveTarget(runSession.effectiveGameState, direction);
      if (!target) return "Player position unavailable.";

      const portalTarget = findDirectionalPortalTarget(runSession.effectiveGameState, direction);
      if (portalTarget) return null;

      const enemyOnTarget = findEnemyAtPosition(runSession.effectiveGameState, target.targetX, target.targetY);
      if (enemyOnTarget) {
        if (!isAttackableEnemy(enemyOnTarget)) {
          return `Ghost at (${target.targetX}, ${target.targetY}) cannot be attacked.`;
        }

        if (!enemyOnTarget.id) {
          return `Enemy at (${target.targetX}, ${target.targetY}) has no id.`;
        }

        return null;
      }

      const breakableInteractive = findBreakableInteractiveAtPosition(
        runSession.effectiveGameState,
        target.targetX,
        target.targetY,
      );
      if (breakableInteractive) {
        if (!breakableInteractive.id) {
          return `Interactive at (${target.targetX}, ${target.targetY}) has no id.`;
        }

        return null;
      }

      if (!isMoveTargetPassable(runSession.effectiveGameState, target.targetX, target.targetY)) {
        return `Blocked target (${target.targetX}, ${target.targetY}).`;
      }

      return null;
    },
    [findDirectionalPortalTarget, runSession],
  );

  const validatePass = useCallback((): string | null => {
    if (!runSession.moveRunId) return "No active run id.";
    if (!runSession.effectiveGameState) return "No run gameState loaded yet.";
    if (runSession.hasPendingUpgradeSelection) return "Upgrade selection is pending.";
    return null;
  }, [runSession]);

  const validateUsePortal = useCallback((): string | null => {
    if (!runSession.moveRunId) return "No active run id.";
    if (!runSession.effectiveGameState) return "No run gameState loaded yet.";
    if (runSession.hasPendingUpgradeSelection) return "Upgrade selection is pending.";
    const player = runSession.effectiveGameState.player;
    if (!player) return "Player position unavailable.";
    const portal = findPortalAtPosition(runSession.effectiveGameState, player.x, player.y);
    if (!portal) return "Player is not standing on a portal.";
    return null;
  }, [runSession]);

  const getDirectionalActionLabel = useCallback(
    (direction: MoveDirection): string => {
      if (!runSession.effectiveGameState) return "Move";
      if (runSession.hasPendingUpgradeSelection) return "Select upgrade first";

      const target = getMoveTarget(runSession.effectiveGameState, direction);
      if (!target) return "Move";

      const portalTarget = findDirectionalPortalTarget(runSession.effectiveGameState, direction);
      if (portalTarget) {
        return portalTarget.id ? `Use portal ${portalTarget.id}` : "Use portal";
      }

      const enemyOnTarget = findEnemyAtPosition(runSession.effectiveGameState, target.targetX, target.targetY);
      if (enemyOnTarget) {
        if (!isAttackableEnemy(enemyOnTarget)) {
          return `Ghost at (${target.targetX},${target.targetY})`;
        }
        return enemyOnTarget.id ? `Attack ${enemyOnTarget.id}` : "Attack";
      }

      const breakableInteractive = findBreakableInteractiveAtPosition(
        runSession.effectiveGameState,
        target.targetX,
        target.targetY,
      );
      if (breakableInteractive) {
        return breakableInteractive.id ? `Break ${breakableInteractive.id}` : `Break ${breakableInteractive.type}`;
      }

      return `Move to (${target.targetX},${target.targetY})`;
    },
    [findDirectionalPortalTarget, runSession],
  );

  const executeMove = useCallback(
    async (direction: MoveDirection) => {
      await runQueuedRuntimeAction(`move:${direction}`, async ({ queuedState, queuedRunId }) => {
        const target = getMoveTarget(queuedState, direction);
        if (!target) return;

        const portalTarget = findDirectionalPortalTarget(queuedState, direction);
        if (portalTarget) {
          const result = await runTeleportMutation.mutateAsync({
            runId: queuedRunId,
          });

          if (result.gameState) {
            runSession.runtimeState.replaceLocalGameState(result.gameState);
          }
          runSession.runtimeState.replaceLastMoveEvents(result.events);
          return;
        }

        const enemyOnTarget = findEnemyAtPosition(queuedState, target.targetX, target.targetY);
        if (enemyOnTarget && !isAttackableEnemy(enemyOnTarget)) return;

        const attackableEnemy = enemyOnTarget && isAttackableEnemy(enemyOnTarget) ? enemyOnTarget : null;
        const breakableInteractive = findBreakableInteractiveAtPosition(queuedState, target.targetX, target.targetY);
        if (attackableEnemy && !attackableEnemy.id) return;
        if (breakableInteractive && !breakableInteractive.id) return;
        if (
          !attackableEnemy &&
          !breakableInteractive &&
          !isMoveTargetPassable(queuedState, target.targetX, target.targetY)
        ) {
          return;
        }

        const result = await runMoveMutation.mutateAsync({
          runId: queuedRunId,
          direction,
          actionType: attackableEnemy ? "attack" : breakableInteractive ? "break" : "move",
          targetEnemyId: attackableEnemy?.id ?? undefined,
          targetId: attackableEnemy ? undefined : breakableInteractive?.id ?? undefined,
          targetX: attackableEnemy || breakableInteractive ? undefined : target.targetX,
          targetY: attackableEnemy || breakableInteractive ? undefined : target.targetY,
        });

        if (result.gameState) {
          runSession.runtimeState.replaceLocalGameState(result.gameState);
        }
        runSession.runtimeState.replaceLastMoveEvents(result.events);
      });
    },
    [findDirectionalPortalTarget, runMoveMutation, runQueuedRuntimeAction, runSession.runtimeState, runTeleportMutation],
  );

  const executePass = useCallback(async () => {
    await runQueuedRuntimeAction("pass", async ({ queuedRunId }) => {
      const result = await runMoveMutation.mutateAsync({
        runId: queuedRunId,
        actionType: "pass",
      });

      if (result.gameState) {
        runSession.runtimeState.replaceLocalGameState(result.gameState);
      }
      runSession.runtimeState.replaceLastMoveEvents(result.events);
    });
  }, [runMoveMutation, runQueuedRuntimeAction, runSession.runtimeState]);

  const queueBufferedInput = useCallback((input: BufferedGameplayInput) => {
    if (!runSession.moveRunId || !runSession.effectiveGameState || runSession.hasPendingUpgradeSelection) return;
    bufferedInputRef.current = input;
  }, [runSession.effectiveGameState, runSession.hasPendingUpgradeSelection, runSession.moveRunId]);

  const flushBufferedInput = useEffectEvent(() => {
    const bufferedInput = bufferedInputRef.current;
    if (!bufferedInput) return;
    if (isAnyActionPending) return;

    if (!runSession.moveRunId || !runSession.effectiveGameState || runSession.hasPendingUpgradeSelection) {
      bufferedInputRef.current = null;
      return;
    }

    bufferedInputRef.current = null;

    if (bufferedInput.kind === "move") {
      if (validateMove(bufferedInput.direction)) return;
      void executeMove(bufferedInput.direction);
      return;
    }

    if (validatePass()) return;
    void executePass();
  });

  useEffect(() => {
    if (runSession.moveRunId && !runSession.hasPendingUpgradeSelection) return;
    bufferedInputRef.current = null;
  }, [runSession.hasPendingUpgradeSelection, runSession.moveRunId]);

  useEffect(() => {
    if (isAnyActionPending || !bufferedInputRef.current) return;
    flushBufferedInput();
  }, [
    isAnyActionPending,
    runSession.effectiveGameState,
    runSession.hasPendingUpgradeSelection,
    runSession.moveRunId,
  ]);

  const handleMove = useCallback(
    async (direction: MoveDirection) => {
      if (isAnyActionPending) {
        queueBufferedInput({ kind: "move", direction });
        return;
      }

      await executeMove(direction);
    },
    [executeMove, isAnyActionPending, queueBufferedInput],
  );

  const handlePass = useCallback(async () => {
    if (isAnyActionPending) {
      queueBufferedInput({ kind: "pass" });
      return;
    }

    await executePass();
  }, [executePass, isAnyActionPending, queueBufferedInput]);

  const handleUsePortal = useCallback(async () => {
    await runQueuedRuntimeAction("portal:use", async ({ queuedState, queuedRunId }) => {
      const player = queuedState.player;
      if (!player) return;
      const portal = findPortalAtPosition(queuedState, player.x, player.y);
      if (!portal) return;

      const result = await runTeleportMutation.mutateAsync({
        runId: queuedRunId,
      });

      if (result.gameState) {
        runSession.runtimeState.replaceLocalGameState(result.gameState);
      }
      runSession.runtimeState.replaceLastMoveEvents(result.events);
    });
  }, [runQueuedRuntimeAction, runSession.runtimeState, runTeleportMutation]);

  const handleRerollUpgrades = useCallback(async () => {
    if (!runSession.moveRunId || !runSession.hasPendingUpgradeSelection) return;
    if (!runSession.hasEnoughTreasureForReroll) return;

    const startedAtMs = performance.now();
    const result = await runRerollMutation.mutateAsync({
      runId: runSession.moveRunId,
    });

    if (runSession.effectiveGameState && runSession.effectiveGameState.runId === runSession.moveRunId) {
      const rewardKey = getRunModeRewardKey(runType);
      const nextPlayer = runSession.effectiveGameState.player
        ? {
            ...runSession.effectiveGameState.player,
            [rewardKey]: result.newTreasure ?? runSession.effectiveGameState.player[rewardKey],
          }
        : null;

      runSession.runtimeState.replaceLocalGameState({
        ...runSession.effectiveGameState,
        player: nextPlayer,
        pendingUpgradeOptions: result.upgradeOptions,
        pendingUpgradeCount: result.upgradeOptions.length,
        currentRerollCount: result.currentRerollCount ?? runSession.effectiveGameState.currentRerollCount,
        nextRerollCost: result.nextRerollCost ?? runSession.effectiveGameState.nextRerollCost,
      });
    }

    runSession.runtimeState.recordActionMetrics("reroll", startedAtMs);
  }, [runRerollMutation, runSession, runType]);

  const handleSelectUpgrade = useCallback(
    async (upgradeId: string) => {
      if (!runSession.moveRunId) return;

      const startedAtMs = performance.now();
      const result = await selectUpgradeMutation.mutateAsync({
        runId: runSession.moveRunId,
        upgradeId,
      });

      if (result.gameState) {
        runSession.runtimeState.replaceLocalGameState(result.gameState);
      }
      runSession.runtimeState.replaceLastMoveEvents(result.events);
      runSession.runtimeState.recordActionMetrics(`upgrade:${upgradeId}`, startedAtMs);
    },
    [runSession, selectUpgradeMutation],
  );

  const hotkeysDisabled = !runSession.moveRunId || !runSession.effectiveGameState;
  const isRefreshDisabled = useMemo(
    () =>
      runSession.isRefreshDisabled ||
      runMoveMutation.isPending ||
      runTeleportMutation.isPending ||
      runRerollMutation.isPending ||
      selectUpgradeMutation.isPending,
    [
      runMoveMutation.isPending,
      runRerollMutation.isPending,
      runSession.isRefreshDisabled,
      runTeleportMutation.isPending,
      selectUpgradeMutation.isPending,
    ],
  );

  return {
    runMoveMutation,
    runTeleportMutation,
    runRerollMutation,
    selectUpgradeMutation,
    isAnyActionPending,
    rerollValidationError,
    isRerollDisabled,
    hotkeysDisabled,
    isRefreshDisabled,
    validateMove,
    validatePass,
    validateUsePortal,
    getDirectionalActionLabel,
    handleMove,
    handlePass,
    handleUsePortal,
    handleRerollUpgrades,
    handleSelectUpgrade,
  };
}

export type RunActionsController = ReturnType<typeof useRunActionsController>;
