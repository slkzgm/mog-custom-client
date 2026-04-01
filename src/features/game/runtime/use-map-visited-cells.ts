import { useEffect, useMemo, useReducer } from "react";

import type { GameStateSnapshot } from "../game.types";
import {
  createEmptyMapVisitedCellsState,
  getVisitedCoordinatesForFloor,
  getVisitedFloorKey,
  rememberVisitedCell,
  sanitizeMapVisitedCellsState,
} from "./map-visited-cells";

const STORAGE_KEY = "mog.map-visited-cells.v1";

type VisitedCellsAction =
  | { type: "record"; gameState: GameStateSnapshot }
  | { type: "reset-floor"; floorKey: string }
  | { type: "reset-all" };

function loadStoredVisitedCellsState() {
  if (typeof window === "undefined") return createEmptyMapVisitedCellsState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyMapVisitedCellsState();
    return sanitizeMapVisitedCellsState(JSON.parse(raw));
  } catch {
    return createEmptyMapVisitedCellsState();
  }
}

function visitedCellsReducer(state: ReturnType<typeof createEmptyMapVisitedCellsState>, action: VisitedCellsAction) {
  if (action.type === "record") {
    return rememberVisitedCell(state, action.gameState);
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

  return createEmptyMapVisitedCellsState();
}

export function useMapVisitedCells(gameState: GameStateSnapshot | null, enabled: boolean) {
  const [visitedCellsState, dispatchVisitedCells] = useReducer(
    visitedCellsReducer,
    undefined,
    loadStoredVisitedCellsState,
  );

  useEffect(() => {
    if (!enabled || !gameState) return;
    dispatchVisitedCells({ type: "record", gameState });
  }, [enabled, gameState]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visitedCellsState));
    } catch {
      // Best-effort local persistence only.
    }
  }, [enabled, visitedCellsState]);

  const visitedCoordinates = useMemo(
    () => getVisitedCoordinatesForFloor(visitedCellsState, gameState),
    [gameState, visitedCellsState],
  );
  const currentFloorKey = useMemo(() => getVisitedFloorKey(gameState), [gameState]);

  const resetCurrentFloor = useMemo(
    () => () => {
      if (!currentFloorKey) return;
      dispatchVisitedCells({ type: "reset-floor", floorKey: currentFloorKey });
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

      dispatchVisitedCells({ type: "reset-all" });
    },
    [],
  );

  if (!enabled) {
    return {
      visitedCoordinates: new Set<string>(),
      visitedCount: 0,
      visitedFloorCount: 0,
      resetCurrentFloor,
      resetAll,
    };
  }

  return {
    visitedCoordinates,
    visitedCount: visitedCoordinates.size,
    visitedFloorCount: Object.keys(visitedCellsState.floors).length,
    resetCurrentFloor,
    resetAll,
  };
}
