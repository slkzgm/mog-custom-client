import { useEffect, useMemo, useReducer } from "react";

import type { GameStateSnapshot } from "../game.types";
import {
  createEmptyMapFogMemoryState,
  getRememberedCoordinatesForFloor,
  getRememberedFloorKey,
  rememberVisibleFog,
  sanitizeMapFogMemoryState,
} from "./map-fog-memory";

const STORAGE_KEY = "mog.map-fog-memory.v1";

type FogMemoryAction =
  | { type: "record"; gameState: GameStateSnapshot }
  | { type: "reset-floor"; floorKey: string }
  | { type: "reset-all" };

function loadStoredFogMemoryState() {
  if (typeof window === "undefined") return createEmptyMapFogMemoryState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyMapFogMemoryState();
    return sanitizeMapFogMemoryState(JSON.parse(raw));
  } catch {
    return createEmptyMapFogMemoryState();
  }
}

function fogMemoryReducer(state: ReturnType<typeof createEmptyMapFogMemoryState>, action: FogMemoryAction) {
  if (action.type === "record") {
    return rememberVisibleFog(state, action.gameState);
  }

  if (action.type === "reset-floor") {
    const nextFloors = { ...state.floors };
    delete nextFloors[action.floorKey];
    return {
      version: 1 as const,
      updatedAt: new Date().toISOString(),
      floors: nextFloors,
    };
  }

  return createEmptyMapFogMemoryState();
}

export function useMapFogMemory(gameState: GameStateSnapshot | null, enabled: boolean) {
  const [fogMemoryState, dispatchFogMemory] = useReducer(fogMemoryReducer, undefined, loadStoredFogMemoryState);

  useEffect(() => {
    if (!enabled || !gameState) return;
    dispatchFogMemory({ type: "record", gameState });
  }, [enabled, gameState]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fogMemoryState));
    } catch {
      // Best-effort local persistence only.
    }
  }, [enabled, fogMemoryState]);

  const rememberedCoordinates = useMemo(
    () => getRememberedCoordinatesForFloor(fogMemoryState, gameState),
    [fogMemoryState, gameState],
  );
  const currentFloorKey = useMemo(() => getRememberedFloorKey(gameState), [gameState]);

  const resetCurrentFloor = useMemo(
    () => () => {
      if (!currentFloorKey) return;
      dispatchFogMemory({ type: "reset-floor", floorKey: currentFloorKey });
    },
    [currentFloorKey],
  );

  const resetAll = useMemo(
    () => () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore local cleanup failures.
        }
      }

      dispatchFogMemory({ type: "reset-all" });
    },
    [],
  );

  if (!enabled) {
    return {
      rememberedCoordinates: new Set<string>(),
      rememberedCount: 0,
      rememberedFloorCount: 0,
      resetCurrentFloor,
      resetAll,
    };
  }

  return {
    rememberedCoordinates,
    rememberedCount: rememberedCoordinates.size,
    rememberedFloorCount: Object.keys(fogMemoryState.floors).length,
    resetCurrentFloor,
    resetAll,
  };
}
