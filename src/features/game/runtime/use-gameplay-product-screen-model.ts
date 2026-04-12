import { useCallback, useEffect, useEffectEvent, useState } from "react";

import { useAuthController } from "../../auth/use-auth-controller";
import { getRunModeDefinition, runModeOrder } from "../game-modes";
import type { RunType } from "../game.types";
import { useClaimsQuery } from "../use-claims-query";
import { useItemBalanceQuery } from "../use-item-balance-query";
import { useWeeklyPoolQuery } from "../use-weekly-pool-query";
import { useBuyKeysController } from "./use-buy-keys-controller";
import { useLocalRunHistory } from "./run-history";
import { useSharedGameplayModel } from "./use-shared-gameplay-model";

const GAMEPLAY_FEEL_STORAGE_KEY = "mog.gameplay-feel-mode.v1";
const LOBBY_REFRESH_INTERVAL_MS = 15_000;

type GameplayFeelMode = "standard" | "preview";

function loadGameplayFeelMode(): GameplayFeelMode {
  if (typeof window === "undefined") return "standard";

  try {
    const stored = window.localStorage.getItem(GAMEPLAY_FEEL_STORAGE_KEY);
    return stored === "preview" ? "preview" : "standard";
  } catch {
    return "standard";
  }
}

export function useGameplayProductScreenModel() {
  const auth = useAuthController();
  const [selectedRunType, setSelectedRunType] = useState<RunType>("NORMAL");
  const [currentView, setCurrentView] = useState<"menu" | "run">("menu");
  const [gameplayFeelMode, setGameplayFeelModeState] = useState<GameplayFeelMode>(loadGameplayFeelMode);
  const enableOptimisticPlayerPreview = gameplayFeelMode === "preview";

  const normalGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "NORMAL",
    includeDerivedState: false,
    enableOptimisticPlayerPreview,
  });
  const worldGameplay = useSharedGameplayModel({
    enabled: auth.isAuthenticated,
    runType: "WORLD",
    includeDerivedState: false,
    enableOptimisticPlayerPreview,
  });
  const amberBalanceQuery = useItemBalanceQuery("amber", auth.isAuthenticated);
  const claimsQuery = useClaimsQuery(auth.isAuthenticated);
  const weeklyPoolQuery = useWeeklyPoolQuery(auth.isAuthenticated);
  const {
    history: completedRunHistory,
    activeRecap: completedRunRecap,
    appendCompletedRun,
    dismissActiveRecap: dismissCompletedRunRecap,
    clearHistory: clearCompletedRunHistory,
  } = useLocalRunHistory();
  const refreshLobbyData = useCallback(async () => {
    await Promise.all([
      normalGameplay.runSession.activeRunQuery.refetch(),
      normalGameplay.runSession.balanceQuery.refetch(),
      worldGameplay.runSession.activeRunQuery.refetch(),
      worldGameplay.runSession.balanceQuery.refetch(),
      amberBalanceQuery.refetch(),
      claimsQuery.refetch(),
      weeklyPoolQuery.refetch(),
    ]);
  }, [
    amberBalanceQuery,
    claimsQuery,
    normalGameplay.runSession.activeRunQuery,
    normalGameplay.runSession.balanceQuery,
    weeklyPoolQuery,
    worldGameplay.runSession.activeRunQuery,
    worldGameplay.runSession.balanceQuery,
  ]);
  const buyKeys = useBuyKeysController({
    balanceQuery: normalGameplay.runSession.balanceQuery,
    onPurchaseConfirmed: refreshLobbyData,
  });

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
  const shouldPollLobbyData = auth.isAuthenticated && currentView === "menu";
  const pollLobbyData = useEffectEvent(() => {
    void refreshLobbyData();
  });

  useEffect(() => {
    if (!shouldPollLobbyData) return undefined;

    const intervalId = window.setInterval(() => {
      pollLobbyData();
    }, LOBBY_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pollLobbyData, shouldPollLobbyData]);

  useEffect(() => {
    const completedRun = normalGameplay.runSession.runtimeState.completedRunSummary;
    if (!completedRun) return;

    appendCompletedRun(completedRun);
    normalGameplay.runSession.runtimeState.clearCompletedRun();
    setCurrentView("menu");
    void refreshLobbyData();
  }, [
    appendCompletedRun,
    refreshLobbyData,
    normalGameplay.runSession.runtimeState,
    normalGameplay.runSession.runtimeState.completedRunSummary,
  ]);

  useEffect(() => {
    const completedRun = worldGameplay.runSession.runtimeState.completedRunSummary;
    if (!completedRun) return;

    appendCompletedRun(completedRun);
    worldGameplay.runSession.runtimeState.clearCompletedRun();
    setCurrentView("menu");
    void refreshLobbyData();
  }, [
    appendCompletedRun,
    refreshLobbyData,
    worldGameplay.runSession.runtimeState,
    worldGameplay.runSession.runtimeState.completedRunSummary,
  ]);

  function openMenu() {
    setCurrentView("menu");
  }

  function openRun() {
    if (!hasAnyLoadedRunState) return;
    setCurrentView("run");
  }

  function setGameplayFeelMode(nextMode: GameplayFeelMode) {
    setGameplayFeelModeState(nextMode);

    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(GAMEPLAY_FEEL_STORAGE_KEY, nextMode);
      } catch {
        // Best-effort local preference only.
      }
    }
  }

  return {
    auth,
    amberBalanceQuery,
    claimsQuery,
    weeklyPoolQuery,
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
    gameplayFeelMode,
    enableOptimisticPlayerPreview,
    setGameplayFeelMode,
    refreshLobbyData,
    completedRunRecap,
    dismissCompletedRunRecap,
    completedRunHistory,
    clearCompletedRunHistory,
    openMenu,
    openRun,
  };
}

export type GameplayProductScreenModel = ReturnType<typeof useGameplayProductScreenModel>;
