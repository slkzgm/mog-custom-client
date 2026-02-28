import { useMemo, useRef, useState } from "react";

import { ApiError } from "../../../lib/http/api-error";
import { gameActionQueue } from "../../realtime/game-action-queue";
import {
  buildAsciiMap,
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  getMoveTarget,
  isMoveTargetPassable,
  moveControlOrder,
} from "../game-map";
import type { GameStateSnapshot, MoveDirection } from "../game.types";
import { useActiveRunQuery } from "../use-active-run-query";
import { useCreateRunMutation } from "../use-create-run-mutation";
import { useGameStatusQuery } from "../use-game-status-query";
import { useKeysBalanceQuery } from "../use-keys-balance-query";
import { useRunMoveMutation } from "../use-run-move-mutation";
import { useRunRerollMutation } from "../use-run-reroll-mutation";
import { useSelectUpgradeMutation } from "../use-select-upgrade-mutation";
import { useRunStateQuery } from "../use-run-state-query";

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code ? ` [${error.code}]` : "";
    return `${error.status}${code} ${error.message}`.trim();
  }

  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function parseIntegerInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

function validateStartRunInput(params: {
  parsedKeysAmount: number | null;
  balance: number | null | undefined;
  hasActiveRun: boolean;
}): string | null {
  if (params.hasActiveRun) {
    return "A run is already active. Finish it before starting a new run.";
  }

  if (params.parsedKeysAmount === null) {
    return "keysAmount must be an integer.";
  }

  if (params.parsedKeysAmount < 1) {
    return "keysAmount must be >= 1.";
  }

  if (params.balance === null || params.balance === undefined) {
    return "Unable to validate keysAmount without balance.";
  }

  if (params.parsedKeysAmount > params.balance) {
    return "keysAmount exceeds current balance.";
  }

  return null;
}

function formatDurationMs(value: number | null): string {
  if (value === null || value < 0) return "-";

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function countTileKinds(mapData: number[][] | null) {
  const counts = {
    wall: 0,
    room: 0,
    corridor: 0,
    other: 0,
  };

  if (!mapData) return counts;

  for (const row of mapData) {
    for (const tile of row) {
      if (tile === 2) counts.wall += 1;
      else if (tile === 1) counts.room += 1;
      else if (tile === 0) counts.corridor += 1;
      else counts.other += 1;
    }
  }

  return counts;
}

function countFogMask(fogMask: number[][] | null) {
  const counts = {
    hidden: 0,
    explored: 0,
    visible: 0,
  };

  if (!fogMask) return counts;

  for (const row of fogMask) {
    for (const cell of row) {
      if (cell === 0) counts.hidden += 1;
      else if (cell === 1) counts.explored += 1;
      else if (cell >= 2) counts.visible += 1;
    }
  }

  return counts;
}

export function GamePanel() {
  const statusQuery = useGameStatusQuery();
  const activeRunQuery = useActiveRunQuery();
  const balanceQuery = useKeysBalanceQuery();
  const createRunMutation = useCreateRunMutation();
  const runMoveMutation = useRunMoveMutation();
  const runRerollMutation = useRunRerollMutation();
  const selectUpgradeMutation = useSelectUpgradeMutation();
  const activeRun = activeRunQuery.data?.activeRun ?? null;
  const activeRunId = activeRunQuery.data?.activeRunId ?? null;
  const runStateQuery = useRunStateQuery(activeRunId);
  const [keysAmountInput, setKeysAmountInput] = useState("1");
  const [localGameState, setLocalGameState] = useState<GameStateSnapshot | null>(null);
  const [lastMoveEvents, setLastMoveEvents] = useState<Record<string, unknown>[]>([]);
  const localGameStateRef = useRef<GameStateSnapshot | null>(null);

  function replaceLocalGameState(nextState: GameStateSnapshot | null) {
    localGameStateRef.current = nextState;
    setLocalGameState(nextState);
  }

  const hasActiveRun = Boolean(activeRunId);
  const balance = balanceQuery.data?.balance;
  const parsedKeysAmount = parseIntegerInput(keysAmountInput);
  const startRunValidationError = validateStartRunInput({
    parsedKeysAmount,
    balance,
    hasActiveRun,
  });
  const canStartRun = !startRunValidationError && !createRunMutation.isPending;

  async function refreshAll() {
    const tasks: Array<Promise<unknown>> = [
      statusQuery.refetch(),
      activeRunQuery.refetch(),
      balanceQuery.refetch(),
    ];

    if (activeRunId) {
      tasks.push(runStateQuery.refetch());
    }

    await Promise.all(tasks);
  }

  async function handleStartRun() {
    if (!canStartRun || parsedKeysAmount === null) return;
    const result = await createRunMutation.mutateAsync({
      keysAmount: parsedKeysAmount,
    });
    replaceLocalGameState(result.gameState);
    setLastMoveEvents([]);
  }

  async function handleResumeActiveRun() {
    if (!activeRunId) return;
    const result = await runStateQuery.refetch();
    const resumedGameState = result.data?.gameState ?? null;
    replaceLocalGameState(resumedGameState);
    setLastMoveEvents([]);
  }

  const resumedGameState =
    runStateQuery.data?.gameState && runStateQuery.data.gameState.runId === activeRunId
      ? runStateQuery.data.gameState
      : null;
  const effectiveGameState = localGameState?.runId === activeRunId ? localGameState : resumedGameState;
  const snapshotSource = effectiveGameState
    ? localGameState?.runId === effectiveGameState.runId
      ? "local"
      : "resume"
    : "-";

  const mapLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return buildAsciiMap(effectiveGameState);
  }, [effectiveGameState]);
  const mapHeight = effectiveGameState?.mapData?.length ?? 0;
  const mapWidth = effectiveGameState?.mapData?.[0]?.length ?? 0;
  const tileCounts = useMemo(() => countTileKinds(effectiveGameState?.mapData ?? null), [effectiveGameState]);
  const fogCounts = useMemo(() => countFogMask(effectiveGameState?.fogMask ?? null), [effectiveGameState]);
  const totalCells = mapWidth * mapHeight;
  const skDefeatedText =
    effectiveGameState?.skDefeated === null || effectiveGameState?.skDefeated === undefined
      ? "-"
      : String(effectiveGameState.skDefeated);

  const player = effectiveGameState?.player ?? null;
  const moveRunId = effectiveGameState?.runId ?? activeRunId;
  const pendingUpgradeOptions = effectiveGameState?.pendingUpgradeOptions ?? [];
  const hasPendingUpgradeSelection = pendingUpgradeOptions.length > 0;
  const enemyLines = useMemo(() => {
    if (!effectiveGameState || !player) return [];

    return effectiveGameState.enemies.map((enemy, index) => {
      const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      const hp =
        enemy.hp !== null && enemy.maxHp !== null ? `${enemy.hp}/${enemy.maxHp}` : enemy.hp ?? enemy.maxHp ?? "-";

      return `${index + 1}. ${enemy.id ?? "enemy"} @(${enemy.x},${enemy.y}) dist=${distance} hp=${hp} dmg=${
        enemy.damage ?? "-"
      } type=${enemy.type} sprite=${enemy.spriteType ?? "-"} cooldown=${enemy.moveCooldown ?? "-"} heavy=${
        enemy.hasHeavyHit ? "yes" : "no"
      } charging=${enemy.isChargingHeavy ? "yes" : "no"}`;
    });
  }, [effectiveGameState, player]);
  const interactiveLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.interactive.map(
      (entity, index) => `${index + 1}. ${entity.id ?? entity.type} [${entity.type}] @(${entity.x},${entity.y})`,
    );
  }, [effectiveGameState]);
  const torchLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.torches.map(
      (torch, index) =>
        `${index + 1}. ${torch.id ?? "torch"} @(${torch.x},${torch.y}) revealed=${torch.isRevealed ?? "-"}`,
    );
  }, [effectiveGameState]);
  const portalLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.portals.map(
      (portal, index) => `${index + 1}. ${portal.id ?? "portal"} @(${portal.x},${portal.y})`,
    );
  }, [effectiveGameState]);
  const pickupLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.pickups.map(
      (pickup, index) => `${index + 1}. ${pickup.id ?? pickup.type} [${pickup.type}] @(${pickup.x},${pickup.y})`,
    );
  }, [effectiveGameState]);
  const trapLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.traps.map(
      (trap, index) => `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] @(${trap.x},${trap.y})`,
    );
  }, [effectiveGameState]);
  const arrowTrapLines = useMemo(() => {
    if (!effectiveGameState) return [];
    return effectiveGameState.arrowTraps.map(
      (trap, index) => `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] @(${trap.x},${trap.y})`,
    );
  }, [effectiveGameState]);

  function validateMove(direction: MoveDirection): string | null {
    if (!moveRunId) return "No active run id.";
    if (!effectiveGameState) return "No run gameState loaded yet.";
    if (hasPendingUpgradeSelection) return "Upgrade selection is pending.";

    const target = getMoveTarget(effectiveGameState, direction);
    if (!target) return "Player position unavailable.";

    const enemyOnTarget = findEnemyAtPosition(effectiveGameState, target.targetX, target.targetY);
    if (enemyOnTarget) {
      if (!enemyOnTarget.id) {
        return `Enemy at (${target.targetX}, ${target.targetY}) has no id.`;
      }

      return null;
    }

    const breakableInteractive = findBreakableInteractiveAtPosition(
      effectiveGameState,
      target.targetX,
      target.targetY,
    );
    if (breakableInteractive) {
      if (!breakableInteractive.id) {
        return `Interactive at (${target.targetX}, ${target.targetY}) has no id.`;
      }

      return null;
    }

    if (!isMoveTargetPassable(effectiveGameState, target.targetX, target.targetY)) {
      return `Blocked target (${target.targetX}, ${target.targetY}).`;
    }

    return null;
  }

  function validatePass(): string | null {
    if (!moveRunId) return "No active run id.";
    if (!effectiveGameState) return "No run gameState loaded yet.";
    if (hasPendingUpgradeSelection) return "Upgrade selection is pending.";
    return null;
  }

  function getDirectionalActionLabel(direction: MoveDirection): string {
    if (!effectiveGameState) return "Move";
    if (hasPendingUpgradeSelection) return "Select upgrade first";

    const target = getMoveTarget(effectiveGameState, direction);
    if (!target) return "Move";

    const enemyOnTarget = findEnemyAtPosition(effectiveGameState, target.targetX, target.targetY);
    if (enemyOnTarget) {
      return enemyOnTarget.id ? `Attack ${enemyOnTarget.id}` : "Attack";
    }

    const breakableInteractive = findBreakableInteractiveAtPosition(
      effectiveGameState,
      target.targetX,
      target.targetY,
    );
    if (breakableInteractive) {
      return breakableInteractive.id ? `Break ${breakableInteractive.id}` : `Break ${breakableInteractive.type}`;
    }

    return `Move to (${target.targetX},${target.targetY})`;
  }

  async function handleMove(direction: MoveDirection) {
    if (localGameStateRef.current?.runId !== effectiveGameState?.runId) {
      localGameStateRef.current = effectiveGameState;
    }

    await gameActionQueue.enqueue(async () => {
      const queuedState = localGameStateRef.current;
      const queuedRunId = queuedState?.runId ?? activeRunId;
      if (!queuedState || !queuedRunId) return;

      const target = getMoveTarget(queuedState, direction);
      if (!target) return;

      const enemyOnTarget = findEnemyAtPosition(queuedState, target.targetX, target.targetY);
      const breakableInteractive = findBreakableInteractiveAtPosition(queuedState, target.targetX, target.targetY);
      if (enemyOnTarget && !enemyOnTarget.id) return;
      if (breakableInteractive && !breakableInteractive.id) return;
      if (!enemyOnTarget && !breakableInteractive && !isMoveTargetPassable(queuedState, target.targetX, target.targetY)) {
        return;
      }

      const result = await runMoveMutation.mutateAsync({
        runId: queuedRunId,
        direction,
        actionType: enemyOnTarget ? "attack" : breakableInteractive ? "break" : "move",
        targetEnemyId: enemyOnTarget?.id ?? undefined,
        targetId: enemyOnTarget ? undefined : breakableInteractive?.id ?? undefined,
        targetX: enemyOnTarget || breakableInteractive ? undefined : target.targetX,
        targetY: enemyOnTarget || breakableInteractive ? undefined : target.targetY,
      });

      if (result.gameState) {
        replaceLocalGameState(result.gameState);
      }
      setLastMoveEvents(result.events);
    });
  }

  async function handlePass() {
    if (localGameStateRef.current?.runId !== effectiveGameState?.runId) {
      localGameStateRef.current = effectiveGameState;
    }

    await gameActionQueue.enqueue(async () => {
      const queuedState = localGameStateRef.current;
      const queuedRunId = queuedState?.runId ?? activeRunId;
      if (!queuedState || !queuedRunId) return;
      if ((queuedState.pendingUpgradeOptions?.length ?? 0) > 0) return;

      const result = await runMoveMutation.mutateAsync({
        runId: queuedRunId,
        actionType: "pass",
      });

      if (result.gameState) {
        replaceLocalGameState(result.gameState);
      }
      setLastMoveEvents(result.events);
    });
  }

  async function handleRerollUpgrades() {
    if (!moveRunId || !hasPendingUpgradeSelection) return;

    const result = await runRerollMutation.mutateAsync({
      runId: moveRunId,
    });

    if (effectiveGameState && effectiveGameState.runId === moveRunId) {
      const nextPlayer = effectiveGameState.player
        ? {
            ...effectiveGameState.player,
            treasure: result.newTreasure ?? effectiveGameState.player.treasure,
          }
        : null;

      replaceLocalGameState({
        ...effectiveGameState,
        player: nextPlayer,
        pendingUpgradeOptions: result.upgradeOptions,
        pendingUpgradeCount: result.upgradeOptions.length,
        currentRerollCount: result.currentRerollCount ?? effectiveGameState.currentRerollCount,
      });
    }
  }

  async function handleSelectUpgrade(upgradeId: string) {
    if (!moveRunId) return;

    const result = await selectUpgradeMutation.mutateAsync({
      runId: moveRunId,
      upgradeId,
    });

    if (result.gameState) {
      replaceLocalGameState(result.gameState);
    }
    setLastMoveEvents(result.events);
  }

  return (
    <section>
      <h2>Game</h2>

      <h3>Status</h3>
      <p>paused: {statusQuery.data?.paused ? "true" : "false"}</p>
      <p>timestamp: {statusQuery.data?.timestamp ?? "-"}</p>
      <button type="button" onClick={() => void statusQuery.refetch()}>
        Refresh status
      </button>
      {statusQuery.isError ? (
        <pre role="alert">status error: {formatError(statusQuery.error)}</pre>
      ) : null}

      <h3>Active run</h3>
      <p>runId: {activeRunId ?? "-"}</p>
      <p>has active run: {activeRun ? "true" : "false"}</p>
      <p>can resume: {runStateQuery.data ? String(runStateQuery.data.canResume) : "-"}</p>
      <button type="button" onClick={() => void activeRunQuery.refetch()}>
        Refresh active run
      </button>
      <button type="button" onClick={() => void handleResumeActiveRun()} disabled={!activeRunId || runStateQuery.isFetching}>
        Load active run state
      </button>
      {activeRun ? <pre>{JSON.stringify(activeRun, null, 2)}</pre> : null}
      {activeRunQuery.isError ? (
        <pre role="alert">active run error: {formatError(activeRunQuery.error)}</pre>
      ) : null}
      {runStateQuery.isError ? (
        <pre role="alert">run state error: {formatError(runStateQuery.error)}</pre>
      ) : null}

      <h3>Keys</h3>
      <p>balance: {balanceQuery.data?.balance ?? "-"}</p>
      <button type="button" onClick={() => void balanceQuery.refetch()}>
        Refresh balance
      </button>
      {balanceQuery.isError ? (
        <pre role="alert">balance error: {formatError(balanceQuery.error)}</pre>
      ) : null}

      <h3>Start run</h3>
      <label htmlFor="keys-amount-input">keysAmount</label>
      <input
        id="keys-amount-input"
        value={keysAmountInput}
        onChange={(event) => setKeysAmountInput(event.target.value)}
        inputMode="numeric"
      />
      <button type="button" onClick={() => void handleStartRun()} disabled={!canStartRun}>
        {createRunMutation.isPending ? "Starting..." : "Start run"}
      </button>
      <p>Last start run id: {createRunMutation.data?.runId ?? "-"}</p>
      <p>Last keys used: {createRunMutation.data?.keysUsed ?? "-"}</p>
      {startRunValidationError ? <pre role="alert">start run validation: {startRunValidationError}</pre> : null}
      {createRunMutation.isError ? (
        <pre role="alert">start run error: {formatError(createRunMutation.error)}</pre>
      ) : null}

      <h3>Map (effective snapshot)</h3>
      <p>snapshot source: {snapshotSource}</p>
      <p>runId: {effectiveGameState?.runId ?? "-"}</p>
      <p>userId: {effectiveGameState?.userId ?? "-"}</p>
      <p>status: {effectiveGameState?.status ?? "-"}</p>
      <p>floor: {effectiveGameState?.currentFloor ?? "-"}</p>
      <p>turn: {effectiveGameState?.turnNumber ?? "-"}</p>
      <p>keys used: {effectiveGameState?.keysUsed ?? "-"}</p>
      <p>time played: {formatDurationMs(effectiveGameState?.timePlayed ?? null)}</p>
      <p>created at: {effectiveGameState?.createdAt ?? "-"}</p>
      <p>last action at: {effectiveGameState?.lastActionAt ?? "-"}</p>
      <p>rerolls used: {effectiveGameState?.currentRerollCount ?? "-"}</p>
      <p>teleports used: {effectiveGameState?.teleportUseCount ?? "-"}</p>
      <p>pending upgrades: {effectiveGameState?.pendingUpgradeCount ?? "-"}</p>
      <p>sk defeated: {skDefeatedText}</p>
      <p>
        map size: {mapWidth}x{mapHeight} ({totalCells} cells)
      </p>
      <p>
        fog: hidden={fogCounts.hidden} explored={fogCounts.explored} visible={fogCounts.visible}
      </p>
      <p>
        tiles: wall={tileCounts.wall} room={tileCounts.room} corridor={tileCounts.corridor} other={tileCounts.other}
      </p>
      <p>
        player pos: {player ? `${player.x},${player.y}` : "-"} / energy: {player?.energy ?? "-"} / max:{" "}
        {player?.maxEnergy ?? "-"}
      </p>
      <p>
        player stats: attack {player?.attackPower ?? "-"} (base {player?.baseAttackPower ?? "-"}) / treasure{" "}
        {player?.treasure ?? "-"} / marbles {player?.marbles ?? "-"} / hongbao {player?.hongbao ?? "-"}
      </p>
      <p>
        player totals: energy spent {player?.totalEnergySpent ?? "-"} / enemies killed{" "}
        {player?.totalEnemiesKilled ?? "-"}
      </p>
      <p>upgrades: {player?.upgrades.length ? player.upgrades.join(", ") : "-"}</p>
      <p>
        active buffs:{" "}
        {player?.activeBuffs.length
          ? player.activeBuffs.map((buff) => `${buff.key}=${String(buff.value)}`).join(", ")
          : "-"}
      </p>
      <p>
        entities: enemies={effectiveGameState?.enemies.length ?? 0} interactive={effectiveGameState?.interactive.length ?? 0}{" "}
        torches={effectiveGameState?.torches.length ?? 0} portals={effectiveGameState?.portals.length ?? 0} pickups=
        {effectiveGameState?.pickups.length ?? 0} traps={effectiveGameState?.traps.length ?? 0} arrowTraps=
        {effectiveGameState?.arrowTraps.length ?? 0}
      </p>
      <p>
        legend: @ player, ? hidden, # wall/void, . room, : corridor, E enemy, &gt; stairs, C crate, I interactive, T
        torch, O portal, $ pickup, ^ trap, A arrow trap
      </p>
      {mapLines.length > 0 ? <pre>{mapLines.join("\n")}</pre> : <p>No local map yet.</p>}
      <p>Enemies detail</p>
      {enemyLines.length > 0 ? <pre>{enemyLines.join("\n")}</pre> : <p>-</p>}
      <p>Interactive detail</p>
      {interactiveLines.length > 0 ? <pre>{interactiveLines.join("\n")}</pre> : <p>-</p>}
      <p>Torches detail</p>
      {torchLines.length > 0 ? <pre>{torchLines.join("\n")}</pre> : <p>-</p>}
      <p>Portals detail</p>
      {portalLines.length > 0 ? <pre>{portalLines.join("\n")}</pre> : <p>-</p>}
      <p>Pickups detail</p>
      {pickupLines.length > 0 ? <pre>{pickupLines.join("\n")}</pre> : <p>-</p>}
      <p>Traps detail</p>
      {trapLines.length > 0 ? <pre>{trapLines.join("\n")}</pre> : <p>-</p>}
      <p>Arrow traps detail</p>
      {arrowTrapLines.length > 0 ? <pre>{arrowTrapLines.join("\n")}</pre> : <p>-</p>}

      <h3>Upgrade Selection</h3>
      <p>pending selection: {hasPendingUpgradeSelection ? "true" : "false"}</p>
      <p>options: {pendingUpgradeOptions.length ? pendingUpgradeOptions.join(", ") : "-"}</p>
      <button
        type="button"
        onClick={() => void handleRerollUpgrades()}
        disabled={!moveRunId || !hasPendingUpgradeSelection || runRerollMutation.isPending || selectUpgradeMutation.isPending}
      >
        {runRerollMutation.isPending ? "Rerolling..." : "Reroll options"}
      </button>
      <p>last reroll success: {runRerollMutation.data ? String(runRerollMutation.data.success) : "-"}</p>
      <p>last reroll cost: {runRerollMutation.data?.treasureCost ?? "-"}</p>
      <p>last reroll treasure: {runRerollMutation.data?.newTreasure ?? "-"}</p>
      <p>last reroll count: {runRerollMutation.data?.currentRerollCount ?? "-"}</p>
      {pendingUpgradeOptions.map((upgradeId) => (
        <button
          key={upgradeId}
          type="button"
          onClick={() => void handleSelectUpgrade(upgradeId)}
          disabled={!moveRunId || runRerollMutation.isPending || selectUpgradeMutation.isPending}
        >
          Select {upgradeId}
        </button>
      ))}
      {runRerollMutation.isError ? (
        <pre role="alert">reroll error: {formatError(runRerollMutation.error)}</pre>
      ) : null}
      {selectUpgradeMutation.isError ? (
        <pre role="alert">upgrade select error: {formatError(selectUpgradeMutation.error)}</pre>
      ) : null}

      <h3>Move</h3>
      <p>runId used for move: {moveRunId ?? "-"}</p>
      {(() => {
        const passValidationError = validatePass();
        const isPassDisabled =
          Boolean(passValidationError) ||
          runMoveMutation.isPending ||
          runRerollMutation.isPending ||
          selectUpgradeMutation.isPending;

        return (
          <button
            key="pass"
            type="button"
            onClick={() => void handlePass()}
            disabled={isPassDisabled}
            title={passValidationError ?? "Pass turn"}
          >
            Skip
          </button>
        );
      })()}
      {moveControlOrder.map((control) => {
        const moveValidationError = validateMove(control.direction);
        const isDisabled =
          Boolean(moveValidationError) ||
          runMoveMutation.isPending ||
          runRerollMutation.isPending ||
          selectUpgradeMutation.isPending;

        return (
          <button
            key={control.direction}
            type="button"
            onClick={() => void handleMove(control.direction)}
            disabled={isDisabled}
            title={moveValidationError ?? getDirectionalActionLabel(control.direction)}
          >
            {control.label}
          </button>
        );
      })}
      <p>Last move success: {runMoveMutation.data ? String(runMoveMutation.data.success) : "-"}</p>
      <p>Last move game over: {runMoveMutation.data ? String(runMoveMutation.data.isGameOver) : "-"}</p>
      {lastMoveEvents.length > 0 ? <pre>{JSON.stringify(lastMoveEvents, null, 2)}</pre> : null}
      {runMoveMutation.isError ? (
        <pre role="alert">move error: {formatError(runMoveMutation.error)}</pre>
      ) : null}

      <hr />
      <button
        type="button"
        onClick={() => void refreshAll()}
        disabled={
          statusQuery.isFetching ||
          activeRunQuery.isFetching ||
          balanceQuery.isFetching ||
          runStateQuery.isFetching ||
          createRunMutation.isPending ||
          runMoveMutation.isPending ||
          runRerollMutation.isPending ||
          selectUpgradeMutation.isPending
        }
      >
        Refresh all
      </button>
    </section>
  );
}
