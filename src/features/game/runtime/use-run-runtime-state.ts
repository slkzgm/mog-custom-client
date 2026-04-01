import { useCallback, useRef, useState } from "react";

import type { GameStateSnapshot } from "../game.types";
import { parseLatestPortalPromptEvent } from "./game-event-parsers";

export interface RuntimeActionMetrics {
  lastActionLatencyMs: number | null;
  lastActionName: string | null;
}

export interface RuntimePortalPrompt {
  portalId: string;
  linkedPortalId: string | null;
  portalX: number;
  portalY: number;
  destinationX: number;
  destinationY: number;
  teleportCost: number | null;
  playerTreasure: number | null;
  playerX: number;
  playerY: number;
}

function parseLatestPortalPrompt(
  events: Record<string, unknown>[],
  gameState: GameStateSnapshot | null,
): RuntimePortalPrompt | null {
  const player = gameState?.player;
  if (!player) return null;

  const latest = parseLatestPortalPromptEvent(events);
  if (!latest) return null;

  return {
    ...latest,
    playerX: player.x,
    playerY: player.y,
  };
}

export function useRunRuntimeState() {
  const [localGameState, setLocalGameState] = useState<GameStateSnapshot | null>(null);
  const [lastMoveEvents, setLastMoveEvents] = useState<Record<string, unknown>[]>([]);
  const [portalPrompt, setPortalPrompt] = useState<RuntimePortalPrompt | null>(null);
  const [metrics, setMetrics] = useState<RuntimeActionMetrics>({
    lastActionLatencyMs: null,
    lastActionName: null,
  });
  const localGameStateRef = useRef<GameStateSnapshot | null>(null);

  const replaceLocalGameState = useCallback((nextState: GameStateSnapshot | null) => {
    localGameStateRef.current = nextState;
    setLocalGameState(nextState);
    setPortalPrompt((current) => {
      if (!current || !nextState?.player) return current;
      return nextState.player.x === current.playerX && nextState.player.y === current.playerY ? current : null;
    });
  }, []);

  const replaceLastMoveEvents = useCallback((events: Record<string, unknown>[]) => {
    setLastMoveEvents(events);
    setPortalPrompt((current) => parseLatestPortalPrompt(events, localGameStateRef.current) ?? current);
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
    portalPrompt,
    metrics,
    replaceLocalGameState,
    replaceLastMoveEvents,
    clearLastMoveEvents,
    recordActionMetrics,
  };
}
