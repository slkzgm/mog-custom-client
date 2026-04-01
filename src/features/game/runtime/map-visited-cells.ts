import type { GameStateSnapshot } from "../game.types";

export interface MapVisitedCellsState {
  version: 1;
  updatedAt: string | null;
  floors: Record<string, string[]>;
}

export function createEmptyMapVisitedCellsState(): MapVisitedCellsState {
  return {
    version: 1,
    updatedAt: null,
    floors: {},
  };
}

function floorKeyOf(gameState: GameStateSnapshot) {
  return `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}`;
}

function coordinateKey(x: number, y: number) {
  return `${x},${y}`;
}

function sortCoordinates(values: string[]) {
  return [...values].sort((left, right) => {
    const [leftX, leftY] = left.split(",").map(Number);
    const [rightX, rightY] = right.split(",").map(Number);
    if (leftY !== rightY) return leftY - rightY;
    return leftX - rightX;
  });
}

export function rememberVisitedCell(state: MapVisitedCellsState, gameState: GameStateSnapshot): MapVisitedCellsState {
  const player = gameState.player;
  if (!player) return state;

  const floorKey = floorKeyOf(gameState);
  const coordinate = coordinateKey(player.x, player.y);
  const existing = state.floors[floorKey] ?? [];
  if (existing.includes(coordinate)) return state;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    floors: {
      ...state.floors,
      [floorKey]: sortCoordinates([...existing, coordinate]),
    },
  };
}

export function sanitizeMapVisitedCellsState(value: unknown): MapVisitedCellsState {
  if (!value || typeof value !== "object") return createEmptyMapVisitedCellsState();
  const candidate = value as Partial<MapVisitedCellsState>;

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

export function getVisitedCoordinatesForFloor(state: MapVisitedCellsState, gameState: GameStateSnapshot | null) {
  if (!gameState) return new Set<string>();
  return new Set(state.floors[floorKeyOf(gameState)] ?? []);
}

export function getVisitedFloorKey(gameState: GameStateSnapshot | null) {
  if (!gameState) return null;
  return floorKeyOf(gameState);
}
