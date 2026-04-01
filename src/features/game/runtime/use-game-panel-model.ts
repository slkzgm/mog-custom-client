import { useBuyKeysController } from "./use-buy-keys-controller";
import { useSharedGameplayModel } from "./use-shared-gameplay-model";

export function useGamePanelModel() {
  const gameplay = useSharedGameplayModel();
  const { runSession, controls, upgrades } = gameplay;
  const buyKeys = useBuyKeysController(runSession);

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
      ...upgrades,
      nextRerollCost: runSession.nextRerollCost,
      canEstimateNextRerollCost: runSession.canEstimateNextRerollCost,
      hasEnoughTreasureForReroll: runSession.hasEnoughTreasureForReroll,
    },
    controls: {
      ...controls,
      isRefreshDisabled: controls.isRefreshDisabled || buyKeys.isBuyKeysReceiptFetching || buyKeys.buyKeysMutation.isPending,
    },
    queries: {
      activeRunQuery: runSession.activeRunQuery,
    },
  };
}

export type GamePanelModel = ReturnType<typeof useGamePanelModel>;
