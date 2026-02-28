import type { EnemySnapshot, GameStateSnapshot, MapEntitySnapshot, MoveDirection } from "./game.types";

interface MoveDelta {
  dx: number;
  dy: number;
}

export const moveControlOrder: Array<{ direction: MoveDirection; label: string }> = [
  { direction: "up", label: "Up" },
  { direction: "left", label: "Left" },
  { direction: "down", label: "Down" },
  { direction: "right", label: "Right" },
];

const moveDeltas: Record<MoveDirection, MoveDelta> = {
  up: { dx: 0, dy: -1 },
  left: { dx: -1, dy: 0 },
  down: { dx: 0, dy: 1 },
  right: { dx: 1, dy: 0 },
};

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

function toEntityLookup(entities: MapEntitySnapshot[]): Map<string, MapEntitySnapshot> {
  const lookup = new Map<string, MapEntitySnapshot>();
  for (const entity of entities) {
    lookup.set(positionKey(entity.x, entity.y), entity);
  }
  return lookup;
}

function tileToChar(tile: number): string {
  if (tile === 0) return ":";
  if (tile === 1) return ".";
  if (tile === 2) return "#";
  return "?";
}

function toTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function interactiveToChar(entity: MapEntitySnapshot): string {
  if (entity.type === "stairs") return ">";
  if (entity.type === "crate") return "C";
  if (entity.type === "door") return "D";
  return "I";
}

function normalizeInteractiveType(type: string): string {
  return type.trim().toLowerCase();
}

export function isBreakableInteractive(entity: MapEntitySnapshot): boolean {
  const type = normalizeInteractiveType(entity.type);

  // Chests and stairs are resolved by movement/adjacency flow, not break actions.
  if (type === "chest" || type === "stairs" || type === "door") {
    return false;
  }

  return true;
}

export function getMoveTarget(
  gameState: GameStateSnapshot,
  direction: MoveDirection,
): { targetX: number; targetY: number } | null {
  const player = gameState.player;
  if (!player) return null;
  const delta = moveDeltas[direction];

  return {
    targetX: player.x + delta.dx,
    targetY: player.y + delta.dy,
  };
}

export function isMoveTargetPassable(
  gameState: GameStateSnapshot,
  targetX: number,
  targetY: number,
): boolean {
  const tile = matrixAt(gameState.mapData, targetX, targetY);
  return tile === 0 || tile === 1;
}

export function findEnemyAtPosition(
  gameState: GameStateSnapshot,
  targetX: number,
  targetY: number,
): EnemySnapshot | null {
  for (const enemy of gameState.enemies) {
    if (enemy.x === targetX && enemy.y === targetY) {
      return enemy;
    }
  }

  return null;
}

export function findBreakableInteractiveAtPosition(
  gameState: GameStateSnapshot,
  targetX: number,
  targetY: number,
): MapEntitySnapshot | null {
  for (const entity of gameState.interactive) {
    if (entity.x !== targetX || entity.y !== targetY) continue;
    if (!isBreakableInteractive(entity)) continue;
    return entity;
  }

  return null;
}

export function buildAsciiMap(gameState: GameStateSnapshot): string[] {
  if (!gameState.mapData) return [];

  const enemiesByPosition = toEntityLookup(gameState.enemies);
  const interactiveByPosition = toEntityLookup(gameState.interactive);
  const torchesByPosition = toEntityLookup(gameState.torches);
  const portalsByPosition = toEntityLookup(gameState.portals);
  const pickupsByPosition = toEntityLookup(gameState.pickups);
  const trapsByPosition = toEntityLookup(gameState.traps);
  const arrowTrapsByPosition = toEntityLookup(gameState.arrowTraps);
  const player = gameState.player;

  const rows: string[] = [];
  const width = gameState.mapData[0]?.length ?? 0;
  if (width > 0) {
    const header = Array.from({ length: width }, (_, index) => toTwoDigits(index)).join(" ");
    rows.push(`    ${header}`);
  }

  for (let y = 0; y < gameState.mapData.length; y += 1) {
    const row = gameState.mapData[y];
    let renderedRow = `${toTwoDigits(y)} |`;

    for (let x = 0; x < row.length; x += 1) {
      const fog = matrixAt(gameState.fogMask, x, y);
      const key = positionKey(x, y);

      if (player && player.x === x && player.y === y) {
        renderedRow += "@ ";
        continue;
      }

      if (fog === 0) {
        renderedRow += "? ";
        continue;
      }

      if (enemiesByPosition.has(key)) {
        renderedRow += "E ";
        continue;
      }

      const interactive = interactiveByPosition.get(key);
      if (interactive) {
        renderedRow += `${interactiveToChar(interactive)} `;
        continue;
      }

      if (pickupsByPosition.has(key)) {
        renderedRow += "$ ";
        continue;
      }

      if (trapsByPosition.has(key)) {
        renderedRow += "^ ";
        continue;
      }

      if (arrowTrapsByPosition.has(key)) {
        renderedRow += "A ";
        continue;
      }

      if (portalsByPosition.has(key)) {
        renderedRow += "O ";
        continue;
      }

      if (torchesByPosition.has(key)) {
        renderedRow += "T ";
        continue;
      }

      const tile = row[x];
      renderedRow += `${typeof tile === "number" ? tileToChar(tile) : "?"} `;
    }

    rows.push(renderedRow.trimEnd());
  }

  return rows;
}
