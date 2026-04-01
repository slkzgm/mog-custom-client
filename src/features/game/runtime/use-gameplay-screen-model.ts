import { useSharedGameplayModel } from "./use-shared-gameplay-model";

export function useGameplayScreenModel() {
  const gameplay = useSharedGameplayModel();

  return {
    runState: gameplay.runState,
    lastMoveEvents: gameplay.lastMoveEvents,
    portalPrompt: gameplay.portalPrompt,
    hasActiveRun: Boolean(gameplay.runSession.activeRunId),
    isActionLocked: gameplay.isActionLocked,
    hotkeysDisabled: gameplay.hotkeysDisabled,
    handleMove: gameplay.controls.handleMove,
    handlePass: gameplay.controls.handlePass,
    portal: {
      runTeleportMutation: gameplay.controls.runTeleportMutation,
      validateUsePortal: gameplay.controls.validateUsePortal,
      handleUsePortal: gameplay.controls.handleUsePortal,
    },
    upgrades: gameplay.upgrades,
  };
}

export type GameplayScreenModel = ReturnType<typeof useGameplayScreenModel>;
