import type { GameStateSnapshot, MapEntitySnapshot, TorchSnapshot } from "../game.types";

export type RememberedEntityKind = "interactive" | "pickup" | "trap" | "arrow-trap" | "portal" | "torch";

export interface RememberedEntity {
  key: string;
  floorKey: string;
  coordKey: string;
  x: number;
  y: number;
  kind: RememberedEntityKind;
  type: string;
  id: string | null;
  value: number | null;
  damage: number | null;
  isRevealed: boolean | null;
  lastSeenAt: string;
}

export interface MapEntityMemoryState {
  version: 1;
  updatedAt: string | null;
  floors: Record<string, Record<string, RememberedEntity>>;
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

function coordKeyOf(x: number, y: number) {
  return `${x},${y}`;
}

function rememberEntity(
  floorKey: string,
  kind: RememberedEntityKind,
  entity: MapEntitySnapshot | TorchSnapshot,
): RememberedEntity {
  const coordKey = coordKeyOf(entity.x, entity.y);
  return {
    key: `${floorKey}:${coordKey}:${kind}`,
    floorKey,
    coordKey,
    x: entity.x,
    y: entity.y,
    kind,
    type: entity.type,
    id: entity.id,
    value: entity.value,
    damage: entity.damage,
    isRevealed: "isRevealed" in entity ? entity.isRevealed : null,
    lastSeenAt: new Date().toISOString(),
  };
}

function isVisible(gameState: GameStateSnapshot, x: number, y: number) {
  const fogValue = matrixAt(gameState.fogMask, x, y);
  return typeof fogValue === "number" && fogValue >= 2;
}

export function createEmptyMapEntityMemoryState(): MapEntityMemoryState {
  return {
    version: 1,
    updatedAt: null,
    floors: {},
  };
}

export function rememberVisibleEntities(state: MapEntityMemoryState, gameState: GameStateSnapshot): MapEntityMemoryState {
  const floorKey = floorKeyOf(gameState);
  const nextFloorEntities = { ...(state.floors[floorKey] ?? {}) };
  const visibleCoords = new Set<string>();
  const presentCoords = new Set<string>();
  let changed = false;

  const visitEntity = (
    kind: RememberedEntityKind,
    entity: MapEntitySnapshot | TorchSnapshot,
  ) => {
    if (!isVisible(gameState, entity.x, entity.y)) return;
    const coordKey = coordKeyOf(entity.x, entity.y);
    visibleCoords.add(coordKey);
    presentCoords.add(coordKey);

    const nextEntity = rememberEntity(floorKey, kind, entity);
    const existing = nextFloorEntities[coordKey];
    if (
      existing &&
      existing.kind === nextEntity.kind &&
      existing.type === nextEntity.type &&
      existing.id === nextEntity.id &&
      existing.value === nextEntity.value &&
      existing.damage === nextEntity.damage &&
      existing.isRevealed === nextEntity.isRevealed
    ) {
      nextFloorEntities[coordKey] = {
        ...existing,
        lastSeenAt: nextEntity.lastSeenAt,
      };
      return;
    }

    nextFloorEntities[coordKey] = nextEntity;
    changed = true;
  };

  for (const entity of gameState.interactive) visitEntity("interactive", entity);
  for (const entity of gameState.pickups) visitEntity("pickup", entity);
  for (const entity of gameState.traps) visitEntity("trap", entity);
  for (const entity of gameState.arrowTraps) visitEntity("arrow-trap", entity);
  for (const entity of gameState.portals) visitEntity("portal", entity);
  for (const entity of gameState.torches) visitEntity("torch", entity);

  const mapHeight = gameState.fogMask?.length ?? 0;
  const mapWidth = gameState.fogMask?.[0]?.length ?? 0;
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      if (!isVisible(gameState, x, y)) continue;
      visibleCoords.add(coordKeyOf(x, y));
    }
  }

  for (const coordKey of visibleCoords) {
    if (presentCoords.has(coordKey)) continue;
    if (!(coordKey in nextFloorEntities)) continue;
    delete nextFloorEntities[coordKey];
    changed = true;
  }

  if (!changed) return state;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    floors: {
      ...state.floors,
      [floorKey]: nextFloorEntities,
    },
  };
}

export function sanitizeMapEntityMemoryState(value: unknown): MapEntityMemoryState {
  if (!value || typeof value !== "object") return createEmptyMapEntityMemoryState();
  const candidate = value as Partial<MapEntityMemoryState>;

  const floors =
    candidate.floors && typeof candidate.floors === "object"
      ? Object.fromEntries(
          Object.entries(candidate.floors).map(([floorKey, rawEntries]) => {
            if (!rawEntries || typeof rawEntries !== "object") return [floorKey, {}];

            const entries = Object.fromEntries(
              Object.entries(rawEntries).filter(([, rawEntry]) => {
                if (!rawEntry || typeof rawEntry !== "object") return false;
                const entry = rawEntry as Partial<RememberedEntity>;
                return (
                  typeof entry.key === "string" &&
                  typeof entry.floorKey === "string" &&
                  typeof entry.coordKey === "string" &&
                  typeof entry.x === "number" &&
                  typeof entry.y === "number" &&
                  typeof entry.kind === "string" &&
                  typeof entry.type === "string" &&
                  typeof entry.lastSeenAt === "string"
                );
              }),
            );

            return [floorKey, entries];
          }),
        )
      : {};

  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    floors,
  };
}

export function getRememberedEntitiesForFloor(state: MapEntityMemoryState, gameState: GameStateSnapshot | null) {
  if (!gameState) return new Map<string, RememberedEntity>();
  const entries = state.floors[floorKeyOf(gameState)] ?? {};
  return new Map(Object.entries(entries));
}

export function getRememberedEntityFloorKey(gameState: GameStateSnapshot | null) {
  if (!gameState) return null;
  return floorKeyOf(gameState);
}
