import type { GameStateSnapshot } from "../game.types";

export type MapSnapshotProbeVerdict = "collecting" | "likely-global" | "suspicious-windowed";

interface TrackedTile {
  floorKey: string;
  x: number;
  y: number;
  tile: number;
  tileData: number | null;
  confirmations: number;
  conflicts: number;
  firstSeenSnapshotKey: string;
  lastSeenSnapshotKey: string;
}

export interface MapSnapshotObservation {
  snapshotKey: string;
  floorKey: string;
  runId: string | null;
  currentFloor: number | null;
  turnNumber: number | null;
  mapWidth: number;
  mapHeight: number;
  playerX: number | null;
  playerY: number | null;
  playerInBounds: boolean | null;
  visibleCount: number;
  exploredCount: number;
  hiddenCount: number;
  trackedTilesAfterSnapshot: number;
  stableMatchesThisSnapshot: number;
  tileConflictsThisSnapshot: number;
  dimensionChangedWithinFloor: boolean;
}

export interface MapSnapshotProbeState {
  version: 1;
  updatedAt: string | null;
  verdict: MapSnapshotProbeVerdict;
  summary: {
    snapshots: number;
    trackedTiles: number;
    stableMatches: number;
    tileConflicts: number;
    dimensionChangesWithinFloor: number;
    playerOutOfBounds: number;
  };
  notes: string[];
  observations: MapSnapshotObservation[];
  trackedTilesByKey: Record<string, TrackedTile>;
  seenSnapshotKeys: string[];
}

const MAX_OBSERVATIONS = 40;
const MAX_SNAPSHOT_KEYS = 120;

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function countFog(fogMask: number[][] | null) {
  const counts = {
    hidden: 0,
    explored: 0,
    visible: 0,
  };

  if (!fogMask) return counts;

  for (const row of fogMask) {
    for (const cell of row) {
      if (cell === 1) counts.explored += 1;
      else if (typeof cell === "number" && cell >= 2) counts.visible += 1;
      else counts.hidden += 1;
    }
  }

  return counts;
}

export function createEmptyMapSnapshotProbeState(): MapSnapshotProbeState {
  return {
    version: 1,
    updatedAt: null,
    verdict: "collecting",
    summary: {
      snapshots: 0,
      trackedTiles: 0,
      stableMatches: 0,
      tileConflicts: 0,
      dimensionChangesWithinFloor: 0,
      playerOutOfBounds: 0,
    },
    notes: ["Need several turns to infer whether the backend sends a full map or a moving viewport."],
    observations: [],
    trackedTilesByKey: {},
    seenSnapshotKeys: [],
  };
}

function deriveVerdict(state: MapSnapshotProbeState): { verdict: MapSnapshotProbeVerdict; notes: string[] } {
  const notes: string[] = [];

  if (state.summary.playerOutOfBounds > 0) {
    notes.push("Player coordinates left the received matrix bounds at least once.");
  }

  if (state.summary.tileConflicts > 0) {
    notes.push("Previously explored coordinates changed tile identity, which is suspicious for a fixed global map.");
  }

  if (state.summary.dimensionChangesWithinFloor > 0) {
    notes.push("Matrix dimensions changed within the same floor.");
  }

  if (state.summary.playerOutOfBounds > 0 || state.summary.tileConflicts > 0) {
    return {
      verdict: "suspicious-windowed",
      notes,
    };
  }

  if (state.summary.snapshots >= 4 && state.summary.trackedTiles >= 24 && state.summary.stableMatches >= 24) {
    notes.push("Several snapshots reused the same absolute coordinates without conflicts.");
    notes.push("The backend is very likely returning a stable floor-sized matrix plus fog state.");
    return {
      verdict: "likely-global",
      notes,
    };
  }

  notes.push("Collect a few more moves on the same floor to increase confidence.");
  return {
    verdict: "collecting",
    notes,
  };
}

function sanitizeObservation(value: unknown): value is MapSnapshotObservation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MapSnapshotObservation>;
  return (
    typeof candidate.snapshotKey === "string" &&
    typeof candidate.floorKey === "string" &&
    typeof candidate.mapWidth === "number" &&
    typeof candidate.mapHeight === "number" &&
    typeof candidate.visibleCount === "number" &&
    typeof candidate.exploredCount === "number" &&
    typeof candidate.hiddenCount === "number" &&
    typeof candidate.trackedTilesAfterSnapshot === "number" &&
    typeof candidate.stableMatchesThisSnapshot === "number" &&
    typeof candidate.tileConflictsThisSnapshot === "number" &&
    typeof candidate.dimensionChangedWithinFloor === "boolean"
  );
}

function sanitizeTrackedTile(value: unknown): value is TrackedTile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TrackedTile>;
  return (
    typeof candidate.floorKey === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number" &&
    typeof candidate.tile === "number" &&
    typeof candidate.confirmations === "number" &&
    typeof candidate.conflicts === "number" &&
    typeof candidate.firstSeenSnapshotKey === "string" &&
    typeof candidate.lastSeenSnapshotKey === "string"
  );
}

export function sanitizeMapSnapshotProbeState(value: unknown): MapSnapshotProbeState {
  if (!value || typeof value !== "object") return createEmptyMapSnapshotProbeState();
  const candidate = value as Partial<MapSnapshotProbeState>;
  const fallback = createEmptyMapSnapshotProbeState();

  const trackedTilesByKey =
    candidate.trackedTilesByKey && typeof candidate.trackedTilesByKey === "object"
      ? Object.fromEntries(
          Object.entries(candidate.trackedTilesByKey).filter(([, trackedTile]) => sanitizeTrackedTile(trackedTile)),
        )
      : {};

  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    verdict:
      candidate.verdict === "collecting" || candidate.verdict === "likely-global" || candidate.verdict === "suspicious-windowed"
        ? candidate.verdict
        : fallback.verdict,
    summary:
      candidate.summary && typeof candidate.summary === "object"
        ? {
            snapshots: typeof candidate.summary.snapshots === "number" ? candidate.summary.snapshots : 0,
            trackedTiles: typeof candidate.summary.trackedTiles === "number" ? candidate.summary.trackedTiles : 0,
            stableMatches: typeof candidate.summary.stableMatches === "number" ? candidate.summary.stableMatches : 0,
            tileConflicts: typeof candidate.summary.tileConflicts === "number" ? candidate.summary.tileConflicts : 0,
            dimensionChangesWithinFloor:
              typeof candidate.summary.dimensionChangesWithinFloor === "number"
                ? candidate.summary.dimensionChangesWithinFloor
                : 0,
            playerOutOfBounds: typeof candidate.summary.playerOutOfBounds === "number" ? candidate.summary.playerOutOfBounds : 0,
          }
        : fallback.summary,
    notes: Array.isArray(candidate.notes) ? candidate.notes.filter((item): item is string => typeof item === "string") : fallback.notes,
    observations: Array.isArray(candidate.observations)
      ? candidate.observations.filter(sanitizeObservation).slice(-MAX_OBSERVATIONS)
      : fallback.observations,
    trackedTilesByKey,
    seenSnapshotKeys: Array.isArray(candidate.seenSnapshotKeys)
      ? candidate.seenSnapshotKeys.filter((item): item is string => typeof item === "string").slice(-MAX_SNAPSHOT_KEYS)
      : [],
  };
}

export function recordMapSnapshotProbe(state: MapSnapshotProbeState, gameState: GameStateSnapshot): MapSnapshotProbeState {
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;
  if (mapWidth === 0 || mapHeight === 0) return state;

  const snapshotKey = `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}:${gameState.turnNumber ?? "?"}`;
  if (state.seenSnapshotKeys.includes(snapshotKey)) return state;

  const floorKey = `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}`;
  const previousObservationOnSameFloor = [...state.observations].reverse().find((entry) => entry.floorKey === floorKey);
  const dimensionChangedWithinFloor = Boolean(
    previousObservationOnSameFloor &&
      (previousObservationOnSameFloor.mapWidth !== mapWidth || previousObservationOnSameFloor.mapHeight !== mapHeight),
  );
  const player = gameState.player;
  const playerInBounds =
    player === null
      ? null
      : player.x >= 0 && player.y >= 0 && player.x < mapWidth && player.y < mapHeight;

  const trackedTilesByKey = { ...state.trackedTilesByKey };
  let stableMatchesThisSnapshot = 0;
  let tileConflictsThisSnapshot = 0;

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const tile = matrixAt(gameState.mapData, x, y);
      if (tile === null) continue;

      const fog = matrixAt(gameState.fogMask, x, y) ?? 0;
      if (fog < 1) continue;

      const tileData = matrixAt(gameState.tileData, x, y);
      const trackedKey = `${floorKey}:${x},${y}`;
      const previousTile = trackedTilesByKey[trackedKey];

      if (!previousTile) {
        trackedTilesByKey[trackedKey] = {
          floorKey,
          x,
          y,
          tile,
          tileData,
          confirmations: 1,
          conflicts: 0,
          firstSeenSnapshotKey: snapshotKey,
          lastSeenSnapshotKey: snapshotKey,
        };
        continue;
      }

      if (previousTile.tile !== tile || previousTile.tileData !== tileData) {
        tileConflictsThisSnapshot += 1;
        trackedTilesByKey[trackedKey] = {
          ...previousTile,
          tile,
          tileData,
          confirmations: previousTile.confirmations + 1,
          conflicts: previousTile.conflicts + 1,
          lastSeenSnapshotKey: snapshotKey,
        };
        continue;
      }

      stableMatchesThisSnapshot += 1;
      trackedTilesByKey[trackedKey] = {
        ...previousTile,
        confirmations: previousTile.confirmations + 1,
        lastSeenSnapshotKey: snapshotKey,
      };
    }
  }

  const fogCounts = countFog(gameState.fogMask);
  const nextState: MapSnapshotProbeState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    verdict: state.verdict,
    summary: {
      snapshots: state.summary.snapshots + 1,
      trackedTiles: Object.keys(trackedTilesByKey).length,
      stableMatches: state.summary.stableMatches + stableMatchesThisSnapshot,
      tileConflicts: state.summary.tileConflicts + tileConflictsThisSnapshot,
      dimensionChangesWithinFloor:
        state.summary.dimensionChangesWithinFloor + (dimensionChangedWithinFloor ? 1 : 0),
      playerOutOfBounds: state.summary.playerOutOfBounds + (playerInBounds === false ? 1 : 0),
    },
    notes: state.notes,
    observations: [
      ...state.observations,
      {
        snapshotKey,
        floorKey,
        runId: gameState.runId,
        currentFloor: gameState.currentFloor,
        turnNumber: gameState.turnNumber,
        mapWidth,
        mapHeight,
        playerX: player?.x ?? null,
        playerY: player?.y ?? null,
        playerInBounds,
        visibleCount: fogCounts.visible,
        exploredCount: fogCounts.explored,
        hiddenCount: fogCounts.hidden,
        trackedTilesAfterSnapshot: Object.keys(trackedTilesByKey).length,
        stableMatchesThisSnapshot,
        tileConflictsThisSnapshot,
        dimensionChangedWithinFloor,
      },
    ].slice(-MAX_OBSERVATIONS),
    trackedTilesByKey,
    seenSnapshotKeys: [...state.seenSnapshotKeys, snapshotKey].slice(-MAX_SNAPSHOT_KEYS),
  };

  const verdict = deriveVerdict(nextState);
  return {
    ...nextState,
    verdict: verdict.verdict,
    notes: verdict.notes,
  };
}
