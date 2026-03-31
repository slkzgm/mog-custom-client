import { useRunActionsController } from "./use-run-actions-controller";
import { useRunSessionController } from "./use-run-session-controller";

export function useGameplayScreenModel() {
  const runSession = useRunSessionController();
  const runActions = useRunActionsController({
    activeRunId: runSession.activeRunId,
    effectiveGameState: runSession.effectiveGameState,
    runtimeState: runSession.runtimeState,
    recoverRunStateFromServer: runSession.recoverRunStateFromServer,
    moveRunId: runSession.moveRunId,
    hasPendingUpgradeSelection: runSession.hasPendingUpgradeSelection,
    hasEnoughTreasureForReroll: runSession.hasEnoughTreasureForReroll,
    nextRerollCost: runSession.nextRerollCost,
    canEstimateNextRerollCost: runSession.canEstimateNextRerollCost,
    pendingUpgradeOptions: runSession.pendingUpgradeOptions,
    isRefreshDisabled: runSession.isRefreshDisabled,
  });

  return {
    runState: runSession.effectiveGameState,
    hasActiveRun: Boolean(runSession.activeRunId),
    isActionLocked: runSession.hasPendingUpgradeSelection || runActions.isAnyActionPending,
    hotkeysDisabled: runActions.hotkeysDisabled,
    handleMove: runActions.handleMove,
    handlePass: runActions.handlePass,
    upgrades: {
      pendingUpgradeOptions: runSession.pendingUpgradeOptions,
      hasPendingUpgradeSelection: runSession.hasPendingUpgradeSelection,
      rerollValidationError: runActions.rerollValidationError,
      isRerollDisabled: runActions.isRerollDisabled,
      runRerollMutation: runActions.runRerollMutation,
      selectUpgradeMutation: runActions.selectUpgradeMutation,
      handleRerollUpgrades: runActions.handleRerollUpgrades,
      handleSelectUpgrade: runActions.handleSelectUpgrade,
    },
  };
}

export type GameplayScreenModel = ReturnType<typeof useGameplayScreenModel>;
