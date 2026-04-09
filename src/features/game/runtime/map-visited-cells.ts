import type { GameStateSnapshot } from "../game.types";

export interface MapVisitedFloorState {
  visitedCoordinates: string[];
  startCoordinate: string | null;
}

export interface MapVisitedCellsState {
  version: 2;
  updatedAt: string | null;
  floors: Record<string, MapVisitedFloorState>;
}

export function createEmptyMapVisitedCellsState(): MapVisitedCellsState {
  return {
    version: 2,
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
  const existing = state.floors[floorKey] ?? {
    visitedCoordinates: [],
    startCoordinate: coordinate,
  };
  if (existing.visitedCoordinates.includes(coordinate)) return state;

  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    floors: {
      ...state.floors,
      [floorKey]: {
        visitedCoordinates: sortCoordinates([...existing.visitedCoordinates, coordinate]),
        startCoordinate: existing.startCoordinate ?? coordinate,
      },
    },
  };
}

export function sanitizeMapVisitedCellsState(value: unknown): MapVisitedCellsState {
  if (!value || typeof value !== "object") return createEmptyMapVisitedCellsState();
  const candidate = value as Partial<MapVisitedCellsState>;

  const floors =
    candidate.floors && typeof candidate.floors === "object"
      ? Object.fromEntries(
          Object.entries(candidate.floors).map(([floorKey, floorState]) => {
            if (Array.isArray(floorState)) {
              return [
                floorKey,
                {
                  visitedCoordinates: floorState.filter((item): item is string => typeof item === "string"),
                  startCoordinate: null,
                } satisfies MapVisitedFloorState,
              ];
            }

            const candidateFloorState = floorState as Partial<MapVisitedFloorState> | null;
            const visitedCoordinates = Array.isArray(candidateFloorState?.visitedCoordinates)
              ? candidateFloorState.visitedCoordinates.filter((item): item is string => typeof item === "string")
              : [];

            return [
              floorKey,
              {
                visitedCoordinates,
                startCoordinate:
                  typeof candidateFloorState?.startCoordinate === "string" ? candidateFloorState.startCoordinate : null,
              } satisfies MapVisitedFloorState,
            ];
          }),
        )
      : {};

  return {
    version: 2,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    floors,
  };
}

export function getVisitedCoordinatesForFloor(state: MapVisitedCellsState, gameState: GameStateSnapshot | null) {
  if (!gameState) return new Set<string>();
  return new Set(state.floors[floorKeyOf(gameState)]?.visitedCoordinates ?? []);
}

export function getStartCoordinateForFloor(state: MapVisitedCellsState, gameState: GameStateSnapshot | null) {
  if (!gameState) return null;
  return state.floors[floorKeyOf(gameState)]?.startCoordinate ?? null;
}

export function getVisitedFloorKey(gameState: GameStateSnapshot | null) {
  if (!gameState) return null;
  return floorKeyOf(gameState);
}
