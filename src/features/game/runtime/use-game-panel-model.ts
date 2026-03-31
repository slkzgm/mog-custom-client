import { useBuyKeysController } from "./use-buy-keys-controller";
import { useRunActionsController } from "./use-run-actions-controller";
import { useRunSessionController } from "./use-run-session-controller";

export function useGamePanelModel() {
  const runSession = useRunSessionController();
  const buyKeys = useBuyKeysController(runSession);
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
    status: {
      query: runSession.statusQuery,
    },
    run: {
      activeRun: runSession.activeRun,
      activeRunId: runSession.activeRunId,
      runStateQuery: runSession.runStateQuery,
      createRunMutation: runSession.createRunMutation,
      effectiveGameState: runSession.effectiveGameState,
      snapshotSource: runSession.snapshotSource,
      keysAmountInput: runSession.keysAmountInput,
      setKeysAmountInput: runSession.setKeysAmountInput,
      startRunValidationError: runSession.startRunValidationError,
      canStartRun: runSession.canStartRun,
      refreshAll: runSession.refreshAll,
      handleStartRun: runSession.handleStartRun,
      handleResumeActiveRun: runSession.handleResumeActiveRun,
      metrics: runSession.runtimeState.metrics,
      lastMoveEvents: runSession.runtimeState.lastMoveEvents,
    },
    resources: {
      balanceQuery: runSession.balanceQuery,
      buyKeys,
    },
    board: {
      player: runSession.player,
      mapLines: runSession.mapLines,
      mapHeight: runSession.mapHeight,
      mapWidth: runSession.mapWidth,
      totalCells: runSession.totalCells,
      tileCounts: runSession.tileCounts,
      fogCounts: runSession.fogCounts,
      skDefeatedText: runSession.skDefeatedText,
      enemyLines: runSession.enemyLines,
      interactiveLines: runSession.interactiveLines,
      torchLines: runSession.torchLines,
      portalLines: runSession.portalLines,
      pickupLines: runSession.pickupLines,
      trapLines: runSession.trapLines,
      arrowTrapLines: runSession.arrowTrapLines,
    },
    upgrades: {
      pendingUpgradeOptions: runSession.pendingUpgradeOptions,
      hasPendingUpgradeSelection: runSession.hasPendingUpgradeSelection,
      nextRerollCost: runSession.nextRerollCost,
      canEstimateNextRerollCost: runSession.canEstimateNextRerollCost,
      hasEnoughTreasureForReroll: runSession.hasEnoughTreasureForReroll,
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
      isAnyActionPending: runActions.isAnyActionPending,
      hotkeysDisabled: runActions.hotkeysDisabled,
      isRefreshDisabled: runActions.isRefreshDisabled || buyKeys.isBuyKeysReceiptFetching || buyKeys.buyKeysMutation.isPending,
      validateMove: runActions.validateMove,
      validatePass: runActions.validatePass,
      getDirectionalActionLabel: runActions.getDirectionalActionLabel,
      handleMove: runActions.handleMove,
      handlePass: runActions.handlePass,
    },
    queries: {
      activeRunQuery: runSession.activeRunQuery,
    },
  };
}

export type GamePanelModel = ReturnType<typeof useGamePanelModel>;
