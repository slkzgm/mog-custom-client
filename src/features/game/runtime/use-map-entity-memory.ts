import { useEffect, useMemo, useReducer } from "react";

import type { GameStateSnapshot } from "../game.types";
import {
  createEmptyMapEntityMemoryState,
  getRememberedEntitiesForFloor,
  getRememberedEntityFloorKey,
  rememberVisibleEntities,
  sanitizeMapEntityMemoryState,
} from "./map-entity-memory";

const STORAGE_KEY = "mog.map-entity-memory.v1";

type EntityMemoryAction =
  | { type: "record"; gameState: GameStateSnapshot }
  | { type: "reset-floor"; floorKey: string }
  | { type: "reset-all" };

function loadStoredEntityMemoryState() {
  if (typeof window === "undefined") return createEmptyMapEntityMemoryState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyMapEntityMemoryState();
    return sanitizeMapEntityMemoryState(JSON.parse(raw));
  } catch {
    return createEmptyMapEntityMemoryState();
  }
}

function entityMemoryReducer(state: ReturnType<typeof createEmptyMapEntityMemoryState>, action: EntityMemoryAction) {
  if (action.type === "record") {
    return rememberVisibleEntities(state, action.gameState);
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

  return createEmptyMapEntityMemoryState();
}

export function useMapEntityMemory(gameState: GameStateSnapshot | null, enabled: boolean) {
  const [entityMemoryState, dispatchEntityMemory] = useReducer(entityMemoryReducer, undefined, loadStoredEntityMemoryState);

  useEffect(() => {
    if (!enabled || !gameState) return;
    dispatchEntityMemory({ type: "record", gameState });
  }, [enabled, gameState]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entityMemoryState));
    } catch {
      // Best-effort local persistence only.
    }
  }, [enabled, entityMemoryState]);

  const rememberedEntities = useMemo(
    () => getRememberedEntitiesForFloor(entityMemoryState, gameState),
    [entityMemoryState, gameState],
  );
  const currentFloorKey = useMemo(() => getRememberedEntityFloorKey(gameState), [gameState]);

  const resetCurrentFloor = useMemo(
    () => () => {
      if (!currentFloorKey) return;
      dispatchEntityMemory({ type: "reset-floor", floorKey: currentFloorKey });
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

      dispatchEntityMemory({ type: "reset-all" });
    },
    [],
  );

  if (!enabled) {
    return {
      rememberedEntities: new Map(),
      rememberedCount: 0,
      resetCurrentFloor,
      resetAll,
    };
  }

  return {
    rememberedEntities,
    rememberedCount: rememberedEntities.size,
    resetCurrentFloor,
    resetAll,
  };
}
