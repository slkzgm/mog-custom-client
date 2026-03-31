import { useCallback, useRef, useState } from "react";

import type { GameStateSnapshot } from "../game.types";

export interface RuntimeActionMetrics {
  lastActionLatencyMs: number | null;
  lastActionName: string | null;
}

export function useRunRuntimeState() {
  const [localGameState, setLocalGameState] = useState<GameStateSnapshot | null>(null);
  const [lastMoveEvents, setLastMoveEvents] = useState<Record<string, unknown>[]>([]);
  const [metrics, setMetrics] = useState<RuntimeActionMetrics>({
    lastActionLatencyMs: null,
    lastActionName: null,
  });
  const localGameStateRef = useRef<GameStateSnapshot | null>(null);

  const replaceLocalGameState = useCallback((nextState: GameStateSnapshot | null) => {
    localGameStateRef.current = nextState;
    setLocalGameState(nextState);
  }, []);

  const replaceLastMoveEvents = useCallback((events: Record<string, unknown>[]) => {
    setLastMoveEvents(events);
  }, []);

  const clearLastMoveEvents = useCallback(() => {
    setLastMoveEvents([]);
  }, []);

  const recordActionMetrics = useCallback((actionName: string, startedAtMs: number) => {
    setMetrics({
      lastActionLatencyMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
      lastActionName: actionName,
    });
  }, []);

  return {
    localGameState,
    localGameStateRef,
    lastMoveEvents,
    metrics,
    replaceLocalGameState,
    replaceLastMoveEvents,
    clearLastMoveEvents,
    recordActionMetrics,
  };
}
