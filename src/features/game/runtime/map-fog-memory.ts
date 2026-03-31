import type { GameStateSnapshot } from "../game.types";

export interface MapFogMemoryState {
  version: 1;
  updatedAt: string | null;
  floors: Record<string, string[]>;
}

export function createEmptyMapFogMemoryState(): MapFogMemoryState {
  return {
    version: 1,
    updatedAt: null,
    floors: {},
  };
}

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function floorKeyOf(gameState: GameStateSnapshot) {
  return `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}`;
}

function coordinateKey(x: number, y: number) {
  return `${x},${y}`;
}

export function rememberVisibleFog(state: MapFogMemoryState, gameState: GameStateSnapshot): MapFogMemoryState {
  const mapHeight = gameState.fogMask?.length ?? 0;
  const mapWidth = gameState.fogMask?.[0]?.length ?? 0;
  if (mapWidth === 0 || mapHeight === 0) return state;

  const floorKey = floorKeyOf(gameState);
  const existing = new Set(state.floors[floorKey] ?? []);
  let changed = false;

  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const fogValue = matrixAt(gameState.fogMask, x, y);
      if (fogValue === null || fogValue < 2) continue;

      const key = coordinateKey(x, y);
      if (existing.has(key)) continue;
      existing.add(key);
      changed = true;
    }
  }

  if (!changed) return state;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    floors: {
      ...state.floors,
      [floorKey]: [...existing].sort((left, right) => {
        const [leftX, leftY] = left.split(",").map(Number);
        const [rightX, rightY] = right.split(",").map(Number);
        if (leftY !== rightY) return leftY - rightY;
        return leftX - rightX;
      }),
    },
  };
}

export function sanitizeMapFogMemoryState(value: unknown): MapFogMemoryState {
  if (!value || typeof value !== "object") return createEmptyMapFogMemoryState();
  const candidate = value as Partial<MapFogMemoryState>;

  const floors =
    candidate.floors && typeof candidate.floors === "object"
      ? Object.fromEntries(
          Object.entries(candidate.floors).map(([floorKey, coordinates]) => [
            floorKey,
            Array.isArray(coordinates) ? coordinates.filter((item): item is string => typeof item === "string") : [],
          ]),
        )
      : {};

  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    floors,
  };
}

export function getRememberedCoordinatesForFloor(state: MapFogMemoryState, gameState: GameStateSnapshot | null) {
  if (!gameState) return new Set<string>();
  return new Set(state.floors[floorKeyOf(gameState)] ?? []);
}

export function getRememberedFloorKey(gameState: GameStateSnapshot | null) {
  if (!gameState) return null;
  return floorKeyOf(gameState);
}
