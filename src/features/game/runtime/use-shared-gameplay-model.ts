import { useRunActionsController } from "./use-run-actions-controller";
import { useRunSessionController } from "./use-run-session-controller";

export function useSharedGameplayModel() {
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
    runSession,
    runActions,
    runState: runSession.effectiveGameState,
    lastMoveEvents: runSession.runtimeState.lastMoveEvents,
    portalPrompt: runSession.runtimeState.portalPrompt,
    isActionLocked: runSession.hasPendingUpgradeSelection || runActions.isAnyActionPending,
    hotkeysDisabled: runActions.hotkeysDisabled,
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
    controls: {
      moveRunId: runSession.moveRunId,
      runMoveMutation: runActions.runMoveMutation,
      runTeleportMutation: runActions.runTeleportMutation,
      isAnyActionPending: runActions.isAnyActionPending,
      hotkeysDisabled: runActions.hotkeysDisabled,
      isRefreshDisabled: runActions.isRefreshDisabled,
      validateMove: runActions.validateMove,
      validatePass: runActions.validatePass,
      validateUsePortal: runActions.validateUsePortal,
      getDirectionalActionLabel: runActions.getDirectionalActionLabel,
      handleMove: runActions.handleMove,
      handlePass: runActions.handlePass,
      handleUsePortal: runActions.handleUsePortal,
    },
  };
}

export type SharedGameplayModel = ReturnType<typeof useSharedGameplayModel>;
