import { useState } from "react";

import { useAuthController } from "../../auth/use-auth-controller";
import { getRunModeDefinition, runModeOrder } from "../game-modes";
import type { RunType } from "../game.types";
import { useClaimsQuery } from "../use-claims-query";
import { useItemBalanceQuery } from "../use-item-balance-query";
import { useBuyKeysController } from "./use-buy-keys-controller";
import { useSharedGameplayModel } from "./use-shared-gameplay-model";

export function useGameplayProductScreenModel() {
  const auth = useAuthController();
  const [selectedRunType, setSelectedRunType] = useState<RunType>("NORMAL");
  const [currentView, setCurrentView] = useState<"menu" | "run">("menu");

  const normalGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "NORMAL",
  });
  const worldGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "WORLD",
  });
  const amberBalanceQuery = useItemBalanceQuery("amber", auth.isAuthenticated);
  const claimsQuery = useClaimsQuery(auth.isAuthenticated);
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
  const hasAnyLoadedRunState = Boolean(normalGameplay.runState || worldGameplay.runState);

  const modeCards = runModeOrder.map((runType) => {
    const definition = getRunModeDefinition(runType);
    const session = gameplayByType[runType];
    const hasLoadedRunState = Boolean(session.runState);

    return {
      runType,
      definition,
      session,
      balance: session.runSession.balanceQuery.data?.balance ?? null,
      hasActiveRun: Boolean(session.runSession.activeRunId),
      hasLoadedRunState,
      handleStartRun: async () => {
        setSelectedRunType(runType);
        await session.runSession.handleStartRun();
        setCurrentView("run");
      },
      handleResumeRun: async () => {
        setSelectedRunType(runType);
        if (!hasLoadedRunState) {
          await session.runSession.handleResumeActiveRun();
        }
        setCurrentView("run");
      },
    };
  });

  const hasRunState = Boolean(gameplay.runState);
  const shouldShowRun = currentView === "run" && hasRunState;
  const shouldShowConnect = !auth.isWalletConnected;
  const shouldShowChainSwitch = auth.isWalletConnected && !auth.isOnExpectedChain;
  const shouldShowSignIn = auth.isWalletConnected && auth.isOnExpectedChain && !auth.isAuthenticated;
  const shouldShowLobby = !shouldShowRun;

  function openMenu() {
    setCurrentView("menu");
  }

  function openRun() {
    if (!hasAnyLoadedRunState) return;
    setCurrentView("run");
  }

  return {
    auth,
    amberBalanceQuery,
    claimsQuery,
    buyKeys,
    gameplay,
    normalGameplay,
    worldGameplay,
    selectedRunType: effectiveRunType,
    setSelectedRunType,
    currentView,
    modeCards,
    hasRunState,
    hasAnyLoadedRunState,
    shouldShowRun,
    shouldShowConnect,
    shouldShowChainSwitch,
    shouldShowSignIn,
    shouldShowLobby,
    openMenu,
    openRun,
  };
}

export type GameplayProductScreenModel = ReturnType<typeof useGameplayProductScreenModel>;
