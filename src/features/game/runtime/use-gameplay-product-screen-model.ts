import { useState } from "react";

import { useAuthController } from "../../auth/use-auth-controller";
import { getRunModeDefinition, runModeOrder } from "../game-modes";
import type { RunType } from "../game.types";
import { useItemBalanceQuery } from "../use-item-balance-query";
import { useBuyKeysController } from "./use-buy-keys-controller";
import { useSharedGameplayModel } from "./use-shared-gameplay-model";

export function useGameplayProductScreenModel() {
  const auth = useAuthController();
  const [selectedRunType, setSelectedRunType] = useState<RunType>("NORMAL");

  const normalGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "NORMAL",
  });
  const worldGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "WORLD",
  });
  const amberBalanceQuery = useItemBalanceQuery("amber", auth.isAuthenticated);
  const buyKeys = useBuyKeysController(normalGameplay.runSession);

  const gameplayByType = {
    NORMAL: normalGameplay,
    WORLD: worldGameplay,
  } as const;
  const effectiveRunType =
    gameplayByType[selectedRunType].runState
      ? selectedRunType
      : normalGameplay.runState
        ? "NORMAL"
        : worldGameplay.runState
          ? "WORLD"
          : selectedRunType;
  const gameplay = gameplayByType[effectiveRunType];

  const modeCards = runModeOrder.map((runType) => {
    const definition = getRunModeDefinition(runType);
    const session = gameplayByType[runType];

    return {
      runType,
      definition,
      session,
      balance: session.runSession.balanceQuery.data?.balance ?? null,
      hasActiveRun: Boolean(session.runSession.activeRunId),
      hasLoadedRunState: Boolean(session.runState),
      handleStartRun: async () => {
        setSelectedRunType(runType);
        await session.runSession.handleStartRun();
      },
      handleResumeRun: async () => {
        setSelectedRunType(runType);
        await session.runSession.handleResumeActiveRun();
      },
    };
  });

  const hasRunState = Boolean(gameplay.runState);
  const shouldShowConnect = !auth.isWalletConnected;
  const shouldShowChainSwitch = auth.isWalletConnected && !auth.isOnExpectedChain;
  const shouldShowSignIn = auth.isWalletConnected && auth.isOnExpectedChain && !auth.isAuthenticated;
  const shouldShowLobby = auth.isAuthenticated && !hasRunState;

  return {
    auth,
    amberBalanceQuery,
    buyKeys,
    gameplay,
    normalGameplay,
    worldGameplay,
    selectedRunType: effectiveRunType,
    setSelectedRunType,
    modeCards,
    hasRunState,
    shouldShowConnect,
    shouldShowChainSwitch,
    shouldShowSignIn,
    shouldShowLobby,
  };
}

export type GameplayProductScreenModel = ReturnType<typeof useGameplayProductScreenModel>;
