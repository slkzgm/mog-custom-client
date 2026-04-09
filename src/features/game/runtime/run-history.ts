import { useCallback, useEffect, useState } from "react";

import { getRunModeRewardValue } from "../game-modes";
import type { GameStateSnapshot, RunType } from "../game.types";

const STORAGE_KEY = "mog.completed-run-history.v1";
const MAX_HISTORY_ENTRIES = 20;

export interface CompletedRunSummary {
  runId: string | null;
  runType: RunType | null;
  outcome: "victory" | "ended";
  endedAt: string;
  currentFloor: number | null;
  turnNumber: number | null;
  keysUsed: number | null;
  energy: number | null;
  maxEnergy: number | null;
  rewardValue: number | null;
  marbles: number | null;
  skDefeated: boolean;
  rerollCount: number | null;
  upgradesPerFloor: Record<string, string>;
}

function sanitizeCompletedRunSummary(value: unknown): CompletedRunSummary | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CompletedRunSummary>;

  return {
    runId: typeof candidate.runId === "string" ? candidate.runId : null,
    runType: candidate.runType === "NORMAL" || candidate.runType === "WORLD" ? candidate.runType : null,
    outcome: candidate.outcome === "victory" ? "victory" : "ended",
    endedAt: typeof candidate.endedAt === "string" ? candidate.endedAt : new Date().toISOString(),
    currentFloor: typeof candidate.currentFloor === "number" ? candidate.currentFloor : null,
    turnNumber: typeof candidate.turnNumber === "number" ? candidate.turnNumber : null,
    keysUsed: typeof candidate.keysUsed === "number" ? candidate.keysUsed : null,
    energy: typeof candidate.energy === "number" ? candidate.energy : null,
    maxEnergy: typeof candidate.maxEnergy === "number" ? candidate.maxEnergy : null,
    rewardValue: typeof candidate.rewardValue === "number" ? candidate.rewardValue : null,
    marbles: typeof candidate.marbles === "number" ? candidate.marbles : null,
    skDefeated: candidate.skDefeated === true,
    rerollCount: typeof candidate.rerollCount === "number" ? candidate.rerollCount : null,
    upgradesPerFloor:
      candidate.upgradesPerFloor && typeof candidate.upgradesPerFloor === "object"
        ? Object.fromEntries(
            Object.entries(candidate.upgradesPerFloor).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
  };
}

function loadStoredHistory() {
  if (typeof window === "undefined") return [] as CompletedRunSummary[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeCompletedRunSummary(entry))
      .filter((entry): entry is CompletedRunSummary => entry !== null)
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

export function createCompletedRunSummary(gameState: GameStateSnapshot): CompletedRunSummary {
  const player = gameState.player;

  return {
    runId: gameState.runId,
    runType: gameState.runType,
    outcome: gameState.skDefeated ? "victory" : "ended",
    endedAt: new Date().toISOString(),
    currentFloor: gameState.currentFloor,
    turnNumber: gameState.turnNumber,
    keysUsed: gameState.keysUsed,
    energy: player?.energy ?? null,
    maxEnergy: player?.maxEnergy ?? null,
    rewardValue: getRunModeRewardValue(gameState.runType ?? "NORMAL", player),
    marbles: player?.marbles ?? null,
    skDefeated: gameState.skDefeated === true,
    rerollCount: gameState.currentRerollCount,
    upgradesPerFloor: gameState.upgradesPerFloor,
  };
}

export function useLocalRunHistory() {
  const [history, setHistory] = useState<CompletedRunSummary[]>(loadStoredHistory);
  const [activeRecap, setActiveRecap] = useState<CompletedRunSummary | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Best-effort local persistence only.
    }
  }, [history]);

  const appendCompletedRun = useCallback((summary: CompletedRunSummary) => {
    setActiveRecap(summary);
    setHistory((current) => {
      const nextHistory = [
        summary,
        ...current.filter((entry) => entry.runId !== summary.runId || entry.endedAt !== summary.endedAt),
      ];
      return nextHistory.slice(0, MAX_HISTORY_ENTRIES);
    });
  }, []);

  const dismissActiveRecap = useCallback(() => {
    setActiveRecap(null);
  }, []);

  const clearHistory = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore local cleanup failures.
      }
    }

    setHistory([]);
  }, []);

  return {
    history,
    activeRecap,
    appendCompletedRun,
    dismissActiveRecap,
    clearHistory,
  };
}
