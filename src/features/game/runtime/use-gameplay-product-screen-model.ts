import { useState } from "react";

import { useAuthController } from "../../auth/use-auth-controller";
import { getRunModeDefinition, runModeOrder } from "../game-modes";
import type { RunType } from "../game.types";
import { useClaimsQuery } from "../use-claims-query";
import { useItemBalanceQuery } from "../use-item-balance-query";
import { useBuyKeysController } from "./use-buy-keys-controller";
import { useSharedGameplayModel } from "./use-shared-gameplay-model";

const GAMEPLAY_FEEL_STORAGE_KEY = "mog.gameplay-feel-mode.v1";

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
    openMenu,
    openRun,
  };
}

export type GameplayProductScreenModel = ReturnType<typeof useGameplayProductScreenModel>;
