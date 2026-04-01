import { useCallback, useRef, useState } from "react";

import type { GameStateSnapshot } from "../game.types";

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseLatestPortalPrompt(
  events: Record<string, unknown>[],
  gameState: GameStateSnapshot | null,
): RuntimePortalPrompt | null {
  const player = gameState?.player;
  if (!player) return null;

  let latest: RuntimePortalPrompt | null = null;

  for (const event of events) {
    const source = asRecord(event);
    if (!source || source.type !== "portal_prompt") continue;

    const portalId = typeof source.portalId === "string" ? source.portalId : null;
    const linkedPortalId = typeof source.linkedPortalId === "string" ? source.linkedPortalId : null;
    const portalX = typeof source.portalX === "number" ? source.portalX : null;
    const portalY = typeof source.portalY === "number" ? source.portalY : null;
    const destinationX = typeof source.destinationX === "number" ? source.destinationX : null;
    const destinationY = typeof source.destinationY === "number" ? source.destinationY : null;
    const teleportCost = typeof source.teleportCost === "number" ? source.teleportCost : null;
    const playerTreasure = typeof source.playerTreasure === "number" ? source.playerTreasure : null;
    if (!portalId || portalX === null || portalY === null || destinationX === null || destinationY === null) continue;

    latest = {
      portalId,
      linkedPortalId,
      portalX,
      portalY,
      destinationX,
      destinationY,
      teleportCost,
      playerTreasure,
      playerX: player.x,
      playerY: player.y,
    };
  }

  return latest;
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
