import { useEffect, useMemo, useReducer } from "react";

import type { GameStateSnapshot } from "../game.types";
import {
  createEmptyMapSnapshotProbeState,
  recordMapSnapshotProbe,
  sanitizeMapSnapshotProbeState,
} from "./map-snapshot-probe";

const STORAGE_KEY = "mog.dev.map-snapshot-probe.v1";

type ProbeAction =
  | { type: "record"; gameState: GameStateSnapshot }
  | { type: "reset" };

function loadStoredProbeState() {
  if (typeof window === "undefined") return createEmptyMapSnapshotProbeState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyMapSnapshotProbeState();
    return sanitizeMapSnapshotProbeState(JSON.parse(raw));
  } catch {
    return createEmptyMapSnapshotProbeState();
  }
}

function probeReducer(state: ReturnType<typeof createEmptyMapSnapshotProbeState>, action: ProbeAction) {
  if (action.type === "reset") {
    return createEmptyMapSnapshotProbeState();
  }

  return recordMapSnapshotProbe(state, action.gameState);
}

export function useMapSnapshotProbe(gameState: GameStateSnapshot | null, enabled: boolean) {
  const [probeState, dispatchProbe] = useReducer(probeReducer, undefined, loadStoredProbeState);

  useEffect(() => {
    if (!enabled || !gameState) return;
    dispatchProbe({ type: "record", gameState });
  }, [enabled, gameState]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(probeState));
      (window as Window & { __mogMapProbe?: unknown }).__mogMapProbe = probeState;
    } catch {
      // Best-effort dev diagnostics only.
    }
  }, [enabled, probeState]);

  const reset = useMemo(
    () => () => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore local cleanup failures.
        }
      }

      dispatchProbe({ type: "reset" });
    },
    [],
  );

  if (!enabled) {
    return {
      probeState: createEmptyMapSnapshotProbeState(),
      reset,
    };
  }

  return {
    probeState,
    reset,
  };
}
