import { useCallback, useMemo, useState } from "react";

import { useActiveRunQuery } from "../use-active-run-query";
import { useCreateRunMutation } from "../use-create-run-mutation";
import { getRunModeDefinition } from "../game-modes";
import { useGameStatusQuery } from "../use-game-status-query";
import { useKeysBalanceQuery } from "../use-keys-balance-query";
import { useRunStateQuery } from "../use-run-state-query";
import type { RunType } from "../game.types";
import { parseIntegerInput, validateStartRunInput } from "./game-runtime.utils";
import { useRunDerivedState } from "./use-run-derived-state";
import { useRunRuntimeState } from "./use-run-runtime-state";

interface UseRunSessionControllerOptions {
  enabled?: boolean;
  runType?: RunType;
}

export function useRunSessionController(options: UseRunSessionControllerOptions = {}) {
  const enabled = options.enabled ?? true;
  const runType = options.runType ?? "NORMAL";
  const mode = getRunModeDefinition(runType);
  const statusQuery = useGameStatusQuery(enabled);
  const activeRunQuery = useActiveRunQuery(runType, enabled);
  const balanceQuery = useKeysBalanceQuery(mode.keyResource, enabled);
  const createRunMutation = useCreateRunMutation();
  const runtimeState = useRunRuntimeState();
  const [keysAmountInput, setKeysAmountInput] = useState("1");

  const activeRun = activeRunQuery.data?.activeRun ?? null;
  const activeRunId = activeRunQuery.data?.activeRunId ?? null;
  const runStateQuery = useRunStateQuery(activeRunId, enabled);
  const hasActiveRun = Boolean(activeRunId);
  const parsedKeysAmount = parseIntegerInput(keysAmountInput);
  const balance = balanceQuery.data?.balance;
  const startRunValidationError = validateStartRunInput({
    parsedKeysAmount,
    balance,
    hasActiveRun: enabled && hasActiveRun,
  });
  const canStartRun = enabled && !startRunValidationError && !createRunMutation.isPending;

  const resumedGameState =
    runStateQuery.data?.gameState && runStateQuery.data.gameState.runId === activeRunId
      ? runStateQuery.data.gameState
      : null;
  const effectiveGameState =
    runtimeState.localGameState?.runId === activeRunId ? runtimeState.localGameState : resumedGameState;
  const snapshotSource = effectiveGameState
    ? runtimeState.localGameState?.runId === effectiveGameState.runId
      ? "local"
      : "resume"
    : "-";

  const derivedState = useRunDerivedState(effectiveGameState);
  const moveRunId = effectiveGameState?.runId ?? activeRunId;

  const refreshAll = useCallback(async () => {
    const tasks: Array<Promise<unknown>> = [
      statusQuery.refetch(),
      activeRunQuery.refetch(),
      balanceQuery.refetch(),
    ];

    if (enabled && activeRunId) {
      tasks.push(runStateQuery.refetch());
    }

    await Promise.all(tasks);
  }, [activeRunId, activeRunQuery, balanceQuery, enabled, runStateQuery, statusQuery]);

  const handleStartRun = useCallback(async () => {
    if (!enabled || !canStartRun || parsedKeysAmount === null) return;

    const result = await createRunMutation.mutateAsync({
      keysAmount: parsedKeysAmount,
      runType,
    });
    runtimeState.replaceLocalGameState(result.gameState);
    runtimeState.clearLastMoveEvents();
  }, [canStartRun, createRunMutation, enabled, parsedKeysAmount, runType, runtimeState]);

  const handleResumeActiveRun = useCallback(async () => {
    if (!enabled || !activeRunId) return;

    const result = await runStateQuery.refetch();
    runtimeState.replaceLocalGameState(result.data?.gameState ?? null);
    runtimeState.clearLastMoveEvents();
  }, [activeRunId, enabled, runStateQuery, runtimeState]);

  const recoverRunStateFromServer = useCallback(
    async (runId: string) => {
      if (!enabled) return;

      const result = await runStateQuery.refetch();
      if (result.data?.gameState && result.data.gameState.runId === runId) {
        runtimeState.replaceLocalGameState(result.data.gameState);
        return;
      }

      const latest = await activeRunQuery.refetch();
      const latestRunId = latest.data?.activeRunId ?? null;
      if (latestRunId === runId) {
        const resumed = await runStateQuery.refetch();
        if (resumed.data?.gameState) {
          runtimeState.replaceLocalGameState(resumed.data.gameState);
        }
      }
    },
    [activeRunQuery, enabled, runStateQuery, runtimeState],
  );

  const isRefreshDisabled = useMemo(
    () =>
      statusQuery.isFetching ||
      activeRunQuery.isFetching ||
      balanceQuery.isFetching ||
      runStateQuery.isFetching ||
      createRunMutation.isPending,
    [activeRunQuery.isFetching, balanceQuery.isFetching, createRunMutation.isPending, runStateQuery.isFetching, statusQuery.isFetching],
  );

  return {
    statusQuery,
    activeRunQuery,
    balanceQuery,
    createRunMutation,
    runType,
    mode,
    runStateQuery,
    runtimeState,
    activeRun,
    activeRunId,
    keysAmountInput,
    setKeysAmountInput,
    parsedKeysAmount,
    startRunValidationError,
    canStartRun,
    effectiveGameState,
    moveRunId,
    snapshotSource,
    refreshAll,
    handleStartRun,
    handleResumeActiveRun,
    recoverRunStateFromServer,
    isRefreshDisabled,
    ...derivedState,
  };
}

export type RunSessionController = ReturnType<typeof useRunSessionController>;
