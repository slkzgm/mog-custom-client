import type { ArrowTrapSnapshot, EnemySnapshot, GameStateSnapshot, MapEntitySnapshot, MoveDirection, TrapSnapshot } from "../game.types";
import { effectiveFogValueAt } from "../game-visibility";
import type { RememberedEntity } from "../runtime/map-entity-memory";
import {
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  getMoveTarget,
  isGhostEnemy,
  selectPrimaryEnemy,
  isAttackableEnemy,
  isMoveTargetPassable,
  moveControlOrder,
} from "../game-map";
import { resolveEnemyVisual } from "../map-enemy-visuals";
import { interactiveValueText, isRockInteractive, resolveInteractiveVisual } from "../map-interactive-visuals";
import { buildPickupStacks, pickupValueText, resolvePickupVisual, type PickupStackVisual } from "../map-pickup-visuals";
import type {
  CellEntity,
  CellStackEntry,
  CellHint,
  FocusOffset,
  FocusViewportSize,
  FocusWindow,
  FogState,
  TileKind,
  ViewMode,
  Viewport,
} from "./map-board-v2.types";

export function keyOf(x: number, y: number) {
  return `${x},${y}`;
}

export function parseCoordinateKey(value: string) {
  const [x, y] = value.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function fogStateAt(gameState: GameStateSnapshot, x: number, y: number): FogState {
  const value = effectiveFogValueAt(gameState, x, y);
  if (value === 1) return "explored";
  if (typeof value === "number" && value >= 2) return "visible";
  return "hidden";
}

export function tileKindAt(gameState: GameStateSnapshot, x: number, y: number): TileKind {
  if (x < 0 || y < 0) return "void";

  const rock = gameState.interactive.find((item) => item.x === x && item.y === y && isRockInteractive(item));
  if (rock) return "wall";

  const value = matrixAt(gameState.mapData, x, y);
  if (value === null) return "void";
  if (value === 2) return "hard-wall";
  if (value === 1) return "wall";
  if (value === 0) return "corridor";
  return "unknown";
}

export interface EntityPositionLookups {
  enemyGroupsByKey: Map<string, EnemySnapshot[]>;
  enemyByKey: Map<string, EnemySnapshot>;
  interactiveGroupsByKey: Map<string, MapEntitySnapshot[]>;
  interactiveByKey: Map<string, MapEntitySnapshot>;
  pickupGroupsByKey: Map<string, MapEntitySnapshot[]>;
  pickupByKey: Map<string, MapEntitySnapshot>;
  trapGroupsByKey: Map<string, TrapSnapshot[]>;
  trapByKey: Map<string, TrapSnapshot>;
  arrowTrapGroupsByKey: Map<string, ArrowTrapSnapshot[]>;
  arrowTrapByKey: Map<string, ArrowTrapSnapshot>;
  portalGroupsByKey: Map<string, MapEntitySnapshot[]>;
  portalByKey: Map<string, MapEntitySnapshot>;
  rockKeys: Set<string>;
}

export function buildEntityPositionLookups(gameState: GameStateSnapshot): EntityPositionLookups {
  const enemyGroupsByKey = toGroupedLookup(gameState.enemies);
  const enemyByKey = toPrimaryLookup(enemyGroupsByKey, selectPrimaryEnemy);
  const interactiveGroupsByKey = toGroupedLookup(gameState.interactive);
  const interactiveByKey = toPrimaryLookup(
    interactiveGroupsByKey,
    (items) => items.find((item) => !isRockInteractive(item)) ?? null,
  );
  const pickupGroupsByKey = toGroupedLookup(gameState.pickups);
  const pickupByKey = toPrimaryLookup(pickupGroupsByKey, (items) => items[0] ?? null);
  const trapGroupsByKey = toGroupedLookup(gameState.traps);
  const trapByKey = toPrimaryLookup(trapGroupsByKey, (items) => items[0] ?? null);
  const arrowTrapGroupsByKey = toArrowTrapGroupedLookup(gameState.arrowTraps);
  const arrowTrapByKey = toPrimaryLookup(arrowTrapGroupsByKey, (items) => items[0] ?? null);
  const portalGroupsByKey = toGroupedLookup(gameState.portals);
  const portalByKey = toPrimaryLookup(portalGroupsByKey, (items) => items[0] ?? null);
  const rockKeys = new Set<string>();

  for (const interactive of gameState.interactive) {
    const key = keyOf(interactive.x, interactive.y);

    if (isRockInteractive(interactive)) {
      rockKeys.add(key);
    }

    if (interactive.type.trim().toLowerCase() === "portal" && !portalByKey.has(key)) {
      portalByKey.set(key, interactive);
    }
  }

  return {
    enemyGroupsByKey,
    enemyByKey,
    interactiveGroupsByKey,
    interactiveByKey,
    pickupGroupsByKey,
    pickupByKey,
    trapGroupsByKey,
    trapByKey,
    arrowTrapGroupsByKey,
    arrowTrapByKey,
    portalGroupsByKey,
    portalByKey,
    rockKeys,
  };
}

export function tileKindAtWithLookups(
  gameState: GameStateSnapshot,
  x: number,
  y: number,
  lookups: Pick<EntityPositionLookups, "rockKeys">,
): TileKind {
  if (x < 0 || y < 0) return "void";
  if (lookups.rockKeys.has(keyOf(x, y))) return "wall";

  const value = matrixAt(gameState.mapData, x, y);
  if (value === null) return "void";
  if (value === 2) return "hard-wall";
  if (value === 1) return "wall";
  if (value === 0) return "corridor";
  return "unknown";
}

export function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function toPreferredCount(value: number, max: number) {
  const clamped = clamp(Math.round(value), 1, max);
  if (clamped <= 2 || clamped === max || clamped % 2 === 1) return clamped;
  return clamped - 1;
}

export function resolveFocusWindow(
  mapWidth: number,
  mapHeight: number,
  focusRadius: number,
  viewportSize: FocusViewportSize | null,
): FocusWindow {
  if (mapWidth <= 0 || mapHeight <= 0) {
    return { columns: 0, rows: 0 };
  }

  const fallbackSpan = Math.min(focusRadius * 2 + 1, mapWidth, mapHeight);
  if (!viewportSize || viewportSize.width <= 0 || viewportSize.height <= 0) {
    return {
      columns: Math.min(mapWidth, fallbackSpan),
      rows: Math.min(mapHeight, fallbackSpan),
    };
  }

  const aspectRatio = clamp(viewportSize.width / viewportSize.height, 0.5, 3.5);
  const baseSpan = focusRadius * 2 + 1;

  if (aspectRatio >= 1) {
    const rows = toPreferredCount(Math.min(baseSpan, mapHeight), mapHeight);
    const columns = toPreferredCount(Math.max(baseSpan, rows * aspectRatio), mapWidth);
    return { columns, rows };
  }

  const columns = toPreferredCount(Math.min(baseSpan, mapWidth), mapWidth);
  const rows = toPreferredCount(Math.max(baseSpan, columns / aspectRatio), mapHeight);
  return { columns, rows };
}

function isGhostEnemyLabels(type: string, spriteType: string | null) {
  const normalizedType = type.trim().toLowerCase();
  const normalizedSprite = spriteType?.trim().toLowerCase() ?? "";
  return normalizedType.includes("ghost") || normalizedSprite.includes("ghost");
}

function normalizeEnemySpriteType(spriteType: string | null) {
  const normalized = spriteType?.trim().toLowerCase() ?? "";
  if (!normalized) return "";
  return normalized.endsWith("_world") ? normalized.slice(0, -6) : normalized;
}

export function intentArrow(direction: "up" | "down" | "left" | "right") {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  if (direction === "left") return "←";
  return "→";
}

function isEnemyAdjacentToPlayer(gameState: GameStateSnapshot, enemyX: number, enemyY: number) {
  const player = gameState.player;
  if (!player) return false;
  return Math.abs(enemyX - player.x) + Math.abs(enemyY - player.y) === 1;
}

function normalizePatternDirection(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "horizontal" || normalized === "vertical") return normalized;
  return null;
}

function patternDirectionDelta(direction: "horizontal" | "vertical", isPositive: boolean) {
  if (direction === "horizontal") {
    return { dx: isPositive ? 1 : -1, dy: 0 };
  }

  return { dx: 0, dy: isPositive ? 1 : -1 };
}

function isPlayerInvisible(gameState: GameStateSnapshot) {
  const turns = gameState.player?.buffsRaw?.invisibilityTurns;
  return typeof turns === "number" && Number.isFinite(turns) && turns > 0;
}

function directionFromDelta(dx: number, dy: number): MoveDirection | null {
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return null;
}

function isBlockingInteractiveType(type: string) {
  const normalized = type.trim().toLowerCase();
  return normalized === "pot" || normalized === "crate" || normalized === "chest" || normalized === "rock" || normalized === "stairs";
}

function isPathBlockingInteractiveType(type: string) {
  const normalized = type.trim().toLowerCase();
  return normalized === "pot" || normalized === "crate" || normalized === "chest" || normalized === "rock";
}

function canEnemyMoveTo(
  gameState: GameStateSnapshot,
  enemy: Pick<EnemySnapshot, "id" | "x" | "y" | "canPassThroughWalls">,
  x: number,
  y: number,
) {
  if (y < 0 || x < 0) return false;
  const row = gameState.mapData?.[y];
  if (!row || x >= row.length) return false;

  if (!enemy.canPassThroughWalls && row[x] !== 0) {
    return false;
  }

  if (gameState.player && x === gameState.player.x && y === gameState.player.y) {
    return false;
  }

  const occupiedByEnemy = gameState.enemies.some(
    (candidate) =>
      candidate.id !== enemy.id &&
      candidate.x === x &&
      candidate.y === y &&
      (candidate.hp === null || candidate.hp > 0),
  );
  if (occupiedByEnemy) return false;

  const blockedByPortal = gameState.interactive.some(
    (item) => item.type.trim().toLowerCase() === "portal" && item.x === x && item.y === y,
  );
  if (blockedByPortal) return false;

  if (!enemy.canPassThroughWalls) {
    const blockedByInteractive = gameState.interactive.some(
      (item) => isBlockingInteractiveType(item.type) && item.x === x && item.y === y,
    );
    if (blockedByInteractive) return false;
  }

  return true;
}

function getDeterministicDetectionRange(enemy: Pick<EnemySnapshot, "spriteType">) {
  const spriteType = normalizeEnemySpriteType(enemy.spriteType);
  if (spriteType === "skeleton") return 8;
  if (spriteType === "skullbat") return 7;
  if (spriteType === "ghost" || spriteType === "ghost2") return 5;
  return 6;
}

function getCardinalMoveOptions(enemy: Pick<EnemySnapshot, "x" | "y">) {
  return [
    { direction: "up" as const, x: enemy.x, y: enemy.y - 1 },
    { direction: "down" as const, x: enemy.x, y: enemy.y + 1 },
    { direction: "left" as const, x: enemy.x - 1, y: enemy.y },
    { direction: "right" as const, x: enemy.x + 1, y: enemy.y },
  ];
}

function predictUniqueRandomMoveDirection(
  gameState: GameStateSnapshot,
  enemy: Pick<EnemySnapshot, "id" | "x" | "y" | "canPassThroughWalls">,
) {
  const validMoves = getCardinalMoveOptions(enemy).filter((move) => canEnemyMoveTo(gameState, enemy, move.x, move.y));
  return validMoves.length === 1 ? validMoves[0].direction : null;
}

function isWalkableForPathfinding(
  gameState: GameStateSnapshot,
  enemy: Pick<EnemySnapshot, "canPassThroughWalls">,
  x: number,
  y: number,
) {
  if (y < 0 || x < 0) return false;
  const row = gameState.mapData?.[y];
  if (!row || x >= row.length) return false;

  if (!enemy.canPassThroughWalls && row[x] !== 0) {
    return false;
  }

  const blockedByPortal = gameState.interactive.some(
    (item) => item.type.trim().toLowerCase() === "portal" && item.x === x && item.y === y,
  );
  if (blockedByPortal) return false;

  if (enemy.canPassThroughWalls) {
    return true;
  }

  return !gameState.interactive.some(
    (item) => isBlockingInteractiveType(item.type) && item.x === x && item.y === y,
  );
}

function findPathTowardPlayer(
  gameState: GameStateSnapshot,
  enemy: Pick<EnemySnapshot, "id" | "x" | "y" | "canPassThroughWalls">,
) {
  const player = gameState.player;
  if (!player) return null;

  const startKey = keyOf(enemy.x, enemy.y);
  const queue = [{ x: enemy.x, y: enemy.y, depth: 0 }];
  const cameFrom = new Map<string, { x: number; y: number } | null>([[startKey, null]]);
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.x === player.x && current.y === player.y) {
      let step = { x: current.x, y: current.y };
      let previous = cameFrom.get(keyOf(step.x, step.y));

      while (previous && !(previous.x === enemy.x && previous.y === enemy.y)) {
        step = previous;
        previous = cameFrom.get(keyOf(step.x, step.y));
      }

      return step;
    }

    if (current.depth >= 20) continue;

    for (const direction of directions) {
      const nextX = current.x + direction.dx;
      const nextY = current.y + direction.dy;
      const nextKey = keyOf(nextX, nextY);

      if (cameFrom.has(nextKey)) continue;
      if (!isWalkableForPathfinding(gameState, enemy, nextX, nextY)) continue;

      cameFrom.set(nextKey, { x: current.x, y: current.y });
      queue.push({ x: nextX, y: nextY, depth: current.depth + 1 });
    }
  }

  return null;
}

function predictChaserNextMoveDirection(gameState: GameStateSnapshot, enemy: Pick<EnemySnapshot, "id" | "x" | "y" | "type" | "spriteType" | "canPassThroughWalls">) {
  const player = gameState.player;
  if (!player) return null;

  const distanceToPlayer = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
  const detectionRange = getDeterministicDetectionRange(enemy);

  if (distanceToPlayer > detectionRange) {
    return predictUniqueRandomMoveDirection(gameState, enemy);
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const directions: Array<{ direction: MoveDirection; x: number; y: number }> = [];

  if (Math.abs(dx) > Math.abs(dy)) {
    directions.push(dx > 0 ? { direction: "right", x: enemy.x + 1, y: enemy.y } : { direction: "left", x: enemy.x - 1, y: enemy.y });
    if (dy > 0) directions.push({ direction: "down", x: enemy.x, y: enemy.y + 1 });
    else if (dy < 0) directions.push({ direction: "up", x: enemy.x, y: enemy.y - 1 });
  } else if (dy !== 0) {
    directions.push(dy > 0 ? { direction: "down", x: enemy.x, y: enemy.y + 1 } : { direction: "up", x: enemy.x, y: enemy.y - 1 });
    if (dx > 0) directions.push({ direction: "right", x: enemy.x + 1, y: enemy.y });
    else if (dx < 0) directions.push({ direction: "left", x: enemy.x - 1, y: enemy.y });
  }

  for (const direction of directions) {
    if (canEnemyMoveTo(gameState, enemy, direction.x, direction.y)) {
      return direction.direction;
    }
  }

  const nextStep = findPathTowardPlayer(gameState, enemy);
  if (!nextStep) return null;
  if (!canEnemyMoveTo(gameState, enemy, nextStep.x, nextStep.y)) return null;
  return directionFromDelta(nextStep.x - enemy.x, nextStep.y - enemy.y);
}

function predictFleeingNextMoveDirection(gameState: GameStateSnapshot, enemy: Pick<EnemySnapshot, "id" | "x" | "y" | "canPassThroughWalls">) {
  const player = gameState.player;
  if (!player) return null;

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const escapeDirections: Array<{ direction: MoveDirection; x: number; y: number; priority: number }> = [];

  if (dx > 0) escapeDirections.push({ direction: "left", x: enemy.x - 1, y: enemy.y, priority: Math.abs(dx) });
  else if (dx < 0) escapeDirections.push({ direction: "right", x: enemy.x + 1, y: enemy.y, priority: Math.abs(dx) });

  if (dy > 0) escapeDirections.push({ direction: "up", x: enemy.x, y: enemy.y - 1, priority: Math.abs(dy) });
  else if (dy < 0) escapeDirections.push({ direction: "down", x: enemy.x, y: enemy.y + 1, priority: Math.abs(dy) });

  escapeDirections.sort((left, right) => right.priority - left.priority);

  for (const direction of escapeDirections) {
    if (canEnemyMoveTo(gameState, enemy, direction.x, direction.y)) {
      return direction.direction;
    }
  }

  const perpendicular: Array<{ direction: MoveDirection; x: number; y: number }> = [];
  if (dx !== 0) {
    perpendicular.push({ direction: "up", x: enemy.x, y: enemy.y - 1 });
    perpendicular.push({ direction: "down", x: enemy.x, y: enemy.y + 1 });
  }
  if (dy !== 0) {
    perpendicular.push({ direction: "left", x: enemy.x - 1, y: enemy.y });
    perpendicular.push({ direction: "right", x: enemy.x + 1, y: enemy.y });
  }

  const validPerpendicular = perpendicular.filter((direction) => canEnemyMoveTo(gameState, enemy, direction.x, direction.y));
  return validPerpendicular.length === 1 ? validPerpendicular[0].direction : null;
}

export function predictEnemyNextMoveDirection(
  gameState: GameStateSnapshot,
  enemy: Pick<
    EnemySnapshot,
    "id" | "x" | "y" | "type" | "spriteType" | "moveCooldown" | "patternDirection" | "patternMovingPositive" | "canPassThroughWalls"
  >,
): MoveDirection | null {
  const playerInvisible = isPlayerInvisible(gameState);
  if (enemy.type === "stationary") return null;
  if (typeof enemy.moveCooldown === "number" && enemy.moveCooldown > 0) return null;
  if (enemy.type === "fleeing") return predictFleeingNextMoveDirection(gameState, enemy);
  if (isEnemyAdjacentToPlayer(gameState, enemy.x, enemy.y) && !playerInvisible) return null;
  if (playerInvisible) return predictUniqueRandomMoveDirection(gameState, enemy);

  if (enemy.type === "chaser") {
    return predictChaserNextMoveDirection(gameState, enemy);
  }

  if (enemy.type === "erratic") {
    return predictUniqueRandomMoveDirection(gameState, enemy);
  }

  if (enemy.type !== "pattern") return null;

  const direction = normalizePatternDirection(enemy.patternDirection);
  if (!direction || enemy.patternMovingPositive === null) return null;

  const delta = patternDirectionDelta(direction, enemy.patternMovingPositive);
  const nextX = enemy.x + delta.dx;
  const nextY = enemy.y + delta.dy;
  if (!canEnemyMoveTo(gameState, enemy, nextX, nextY)) return null;

  if (delta.dx === 1) return "right";
  if (delta.dx === -1) return "left";
  if (delta.dy === 1) return "down";
  return "up";
}

export function selectedEnemyIntent(gameState: GameStateSnapshot, enemy: EnemySnapshot) {
  const spriteType = normalizeEnemySpriteType(enemy.spriteType);
  const nextMove = predictEnemyNextMoveDirection(gameState, enemy);

  if (isEnemyAdjacentToPlayer(gameState, enemy.x, enemy.y)) {
    if (enemy.type === "fleeing") return "adjacent strike";
    return "adjacent attack";
  }

  if (typeof enemy.moveCooldown === "number" && enemy.moveCooldown > 0) {
    return `waiting (${enemy.moveCooldown})`;
  }

  if (enemy.type === "pattern") {
    return nextMove ? `move ${nextMove}` : "blocked / flip soon";
  }

  if (enemy.type === "fleeing") {
    if (nextMove) return `flee ${nextMove}`;
    return spriteType === "pengu" ? "fleeing event mob" : "fleeing boss";
  }

  if (enemy.type === "stationary") {
    return spriteType === "shroom" ? "stationary line attacker" : "stationary";
  }

  if (enemy.type === "erratic") {
    return nextMove ? `move ${nextMove}` : "random movement";
  }

  if (enemy.type === "wobble") {
    return "wobble out / return";
  }

  if (isGhostEnemyLabels(enemy.type, enemy.spriteType)) {
    return enemy.damage !== null && enemy.damage > 0 ? "phase chase" : "harmless phase chase";
  }

  if (enemy.type === "chaser" && spriteType === "mimic") {
    if (nextMove) return `ambush ${nextMove}`;
    return "ambush chase";
  }

  if (enemy.hasHeavyHit) {
    if (nextMove) return `move ${nextMove}`;
    return "heavy chase";
  }

  if (enemy.type === "chaser") {
    return nextMove ? `move ${nextMove}` : "chase if in range";
  }

  return "move";
}

export function buildViewport(
  gameState: GameStateSnapshot,
  mode: ViewMode,
  focusWindow: FocusWindow,
  focusOffset: FocusOffset,
): Viewport {
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;

  if (mapWidth === 0 || mapHeight === 0) {
    return { minX: 0, maxX: -1, minY: 0, maxY: -1 };
  }

  if (mode === "full" || !gameState.player) {
    return { minX: 0, maxX: mapWidth - 1, minY: 0, maxY: mapHeight - 1 };
  }

  const visibleWidth = Math.min(focusWindow.columns, mapWidth);
  const visibleHeight = Math.min(focusWindow.rows, mapHeight);
  const radiusX = Math.floor((visibleWidth - 1) / 2);
  const radiusY = Math.floor((visibleHeight - 1) / 2);
  const centerX = gameState.player.x + focusOffset.x;
  const centerY = gameState.player.y + focusOffset.y;

  return {
    minX: visibleWidth >= mapWidth ? 0 : centerX - radiusX,
    maxX: visibleWidth >= mapWidth ? mapWidth - 1 : centerX + radiusX,
    minY: visibleHeight >= mapHeight ? 0 : centerY - radiusY,
    maxY: visibleHeight >= mapHeight ? mapHeight - 1 : centerY + radiusY,
  };
}

export function getFocusOffsetBounds(gameState: GameStateSnapshot, focusWindow: FocusWindow) {
  const player = gameState.player;
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;

  if (!player || mapWidth === 0 || mapHeight === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }

  const visibleWidth = Math.min(focusWindow.columns, mapWidth);
  const visibleHeight = Math.min(focusWindow.rows, mapHeight);

  return {
    minX: visibleWidth >= mapWidth ? 0 : -player.x,
    maxX: visibleWidth >= mapWidth ? 0 : mapWidth - 1 - player.x,
    minY: visibleHeight >= mapHeight ? 0 : -player.y,
    maxY: visibleHeight >= mapHeight ? 0 : mapHeight - 1 - player.y,
  };
}

export function buildHints(gameState: GameStateSnapshot) {
  const hints = new Map<string, CellHint>();
  if (!gameState.player) return hints;

  for (const control of moveControlOrder) {
    const target = getMoveTarget(gameState, control.direction);
    if (!target) continue;

    const enemy = findEnemyAtPosition(gameState, target.targetX, target.targetY);
    if (enemy) {
      const isAttack = isAttackableEnemy(enemy);
      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        kind: isAttack ? "attack" : "blocked",
        label: isAttack ? "Attack" : "Blocked",
      });
      continue;
    }

    const interactive = findBreakableInteractiveAtPosition(gameState, target.targetX, target.targetY);
    if (interactive) {
      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        kind: "break",
        label: "Break",
      });
      continue;
    }

    const isPassable = isMoveTargetPassable(gameState, target.targetX, target.targetY);
    hints.set(keyOf(target.targetX, target.targetY), {
      direction: control.direction,
      kind: isPassable ? "move" : "blocked",
      label: isPassable ? "Move" : "Blocked",
    });
  }

  return hints;
}

export function findKnownStairsKey(
  gameState: GameStateSnapshot,
  rememberedEntities: Map<string, RememberedEntity>,
) {
  const visibleStairs = gameState.interactive.find((item) => item.type.trim().toLowerCase() === "stairs");
  if (visibleStairs) return keyOf(visibleStairs.x, visibleStairs.y);

  for (const [key, entity] of rememberedEntities) {
    if (entity.kind === "interactive" && entity.type.trim().toLowerCase() === "stairs") {
      return key;
    }
  }

  return null;
}

export function buildKnownStairsPath(
  gameState: GameStateSnapshot,
  lookups: EntityPositionLookups,
  rememberedEntities: Map<string, RememberedEntity>,
) {
  const player = gameState.player;
  if (!player) return { distance: null, trailKeys: new Set<string>(), stairsKey: null };

  const stairsKey = findKnownStairsKey(gameState, rememberedEntities);
  if (!stairsKey) return { distance: null, trailKeys: new Set<string>(), stairsKey: null };

  const stairsCoordinates = parseCoordinateKey(stairsKey);
  if (!stairsCoordinates) return { distance: null, trailKeys: new Set<string>(), stairsKey: null };

  const queue = [{ x: player.x, y: player.y }];
  const startKey = keyOf(player.x, player.y);
  const visited = new Set<string>([startKey]);
  const cameFrom = new Map<string, string | null>([[startKey, null]]);
  const directions = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (current.x === stairsCoordinates.x && current.y === stairsCoordinates.y) {
      const trailKeys = new Set<string>();
      let cursorKey = keyOf(current.x, current.y);
      let distance = 0;

      while (cursorKey && cursorKey !== startKey) {
        trailKeys.add(cursorKey);
        distance += 1;
        const previousKey = cameFrom.get(cursorKey) ?? null;
        if (!previousKey) break;
        cursorKey = previousKey;
      }

      return {
        distance,
        trailKeys,
        stairsKey,
      };
    }

    for (const direction of directions) {
      const nextX = current.x + direction.dx;
      const nextY = current.y + direction.dy;
      const nextKey = keyOf(nextX, nextY);
      if (visited.has(nextKey)) continue;

      const fog = fogStateAt(gameState, nextX, nextY);
      if (fog === "hidden") continue;

      const tile = tileKindAtWithLookups(gameState, nextX, nextY, lookups);
      if (tile !== "corridor") continue;

      const visibleBlockingInteractive = lookups.interactiveGroupsByKey.get(nextKey)?.some((item) => isPathBlockingInteractiveType(item.type)) ?? false;
      if (visibleBlockingInteractive) continue;

      const rememberedBlockingInteractive = rememberedEntities.get(nextKey);
      if (
        rememberedBlockingInteractive &&
        rememberedBlockingInteractive.kind === "interactive" &&
        isPathBlockingInteractiveType(rememberedBlockingInteractive.type)
      ) {
        continue;
      }

      visited.add(nextKey);
      cameFrom.set(nextKey, keyOf(current.x, current.y));
      queue.push({ x: nextX, y: nextY });
    }
  }

  return {
    distance: null,
    trailKeys: new Set<string>(),
    stairsKey,
  };
}

export function toLookup<T extends { x: number; y: number }>(items: T[]) {
  const lookup = new Map<string, T>();

  for (const item of items) {
    lookup.set(keyOf(item.x, item.y), item);
  }

  return lookup;
}

export function toGroupedLookup<T extends { x: number; y: number }>(items: T[]) {
  const lookup = new Map<string, T[]>();

  for (const item of items) {
    const key = keyOf(item.x, item.y);
    const current = lookup.get(key);
    if (current) {
      current.push(item);
      continue;
    }
    lookup.set(key, [item]);
  }

  return lookup;
}

export function toArrowTrapGroupedLookup(items: ArrowTrapSnapshot[]) {
  const lookup = new Map<string, ArrowTrapSnapshot[]>();

  for (const item of items) {
    const key = keyOf(item.triggerX, item.triggerY);
    const current = lookup.get(key);
    if (current) {
      current.push(item);
      continue;
    }
    lookup.set(key, [item]);
  }

  return lookup;
}

function toPrimaryLookup<T extends { x: number; y: number }>(
  groups: Map<string, T[]>,
  pickPrimary: (items: T[]) => T | null,
) {
  const lookup = new Map<string, T>();

  for (const [key, items] of groups) {
    const primary = pickPrimary(items);
    if (primary) {
      lookup.set(key, primary);
    }
  }

  return lookup;
}

function labelEnemyOccupant(enemy: EnemySnapshot): CellStackEntry {
  const visual = resolveEnemyVisual(enemy);
  return {
    kind: "enemy",
    label: visual.label,
    isAttackable: isAttackableEnemy(enemy),
  };
}

function labelInteractiveOccupant(entity: MapEntitySnapshot): CellStackEntry | null {
  if (isRockInteractive(entity)) return null;
  if (entity.type.trim().toLowerCase() === "portal") return null;
  return {
    kind: "interactive",
    label: resolveInteractiveVisual(entity).label,
  };
}

function labelPickupStackOccupant(stack: PickupStackVisual): CellStackEntry {
  const valueText = pickupValueText(stack.totalValue);
  const countText = stack.count > 1 ? ` x${stack.count}` : "";

  return {
    kind: "pickup",
    label: `${stack.visual.label}${valueText ? ` ${valueText}` : countText}`,
  };
}

function labelMapEntityOccupant(kind: "trap" | "arrow-trap" | "portal", entity: MapEntitySnapshot): CellStackEntry {
  return {
    kind,
    label: kind === "arrow-trap" ? `${entity.type} trigger` : entity.type,
  };
}

function sortEnemyStack(enemies: EnemySnapshot[]) {
  return [...enemies].sort((left, right) => {
    const leftScore = isGhostEnemy(left) ? 1 : 0;
    const rightScore = isGhostEnemy(right) ? 1 : 0;
    return rightScore - leftScore;
  });
}

function selectVisibleEnemy(enemies: EnemySnapshot[]) {
  if (enemies.length === 0) return null;
  return enemies.find(isGhostEnemy) ?? enemies.find(isAttackableEnemy) ?? enemies[0] ?? null;
}

function sumEnemyDamage(enemies: EnemySnapshot[]) {
  return enemies.reduce((total, enemy) => total + (typeof enemy.damage === "number" && Number.isFinite(enemy.damage) ? enemy.damage : 0), 0);
}

export function resolveCellOccupantsWithLookups(
  gameState: GameStateSnapshot,
  x: number,
  y: number,
  lookups: EntityPositionLookups,
): CellStackEntry[] {
  const key = keyOf(x, y);
  const occupants: CellStackEntry[] = [];

  if (gameState.player && gameState.player.x === x && gameState.player.y === y) {
    occupants.push({ kind: "player", label: "Player" });
  }

  for (const enemy of sortEnemyStack(lookups.enemyGroupsByKey.get(key) ?? [])) {
    occupants.push(labelEnemyOccupant(enemy));
  }

  for (const interactive of lookups.interactiveGroupsByKey.get(key) ?? []) {
    const occupant = labelInteractiveOccupant(interactive);
    if (occupant) {
      occupants.push(occupant);
    }
  }

  for (const pickupStack of buildPickupStacks(lookups.pickupGroupsByKey.get(key) ?? [])) {
    occupants.push(labelPickupStackOccupant(pickupStack));
  }

  for (const trap of lookups.trapGroupsByKey.get(key) ?? []) {
    occupants.push(labelMapEntityOccupant("trap", trap));
  }

  for (const arrowTrap of lookups.arrowTrapGroupsByKey.get(key) ?? []) {
    occupants.push(labelMapEntityOccupant("arrow-trap", arrowTrap));
  }

  for (const portal of lookups.portalGroupsByKey.get(key) ?? []) {
    occupants.push(labelMapEntityOccupant("portal", portal));
  }

  if (occupants.some((occupant) => occupant.kind === "portal")) {
    return occupants;
  }

  for (const interactive of lookups.interactiveGroupsByKey.get(key) ?? []) {
    if (interactive.type.trim().toLowerCase() !== "portal") continue;
    occupants.push({
      kind: "portal",
      label: interactive.type,
    });
  }

  return occupants;
}

export function rememberedEntityToCellEntity(entity: RememberedEntity): CellEntity | null {
  if (entity.kind === "interactive") {
    const visual = resolveInteractiveVisual(entity.type);
    const valueText = interactiveValueText(entity);

    return {
      kind: "interactive",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio: null,
      showToken: visual.showToken,
      useWallSurface: visual.useWallSurface,
      badges: valueText
        ? [
            {
              position: "se",
              text: valueText,
              tone: "value",
            },
          ]
        : [],
      isPortalPromptActive: false,
    };
  }

  if (entity.kind === "pickup") {
    const visual = resolvePickupVisual(entity.type);
    const valueText = pickupValueText(entity.value);

    return {
      kind: "pickup",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: valueText
        ? [
            {
              position: "se",
              text: valueText,
              tone: "value",
            },
          ]
        : [],
      isPortalPromptActive: false,
    };
  }

  if (entity.kind === "trap" || entity.kind === "arrow-trap") {
    return {
      kind: entity.kind,
      label: entity.type,
      token: entity.kind === "arrow-trap" ? "A" : "^",
      accent: "trap",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  if (entity.kind === "portal") {
    return {
      kind: "portal",
      label: entity.type,
      token: "O",
      accent: "portal",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  return null;
}

export function resolveEntity(gameState: GameStateSnapshot, x: number, y: number): CellEntity | null {
  return resolveEntityWithLookups(gameState, x, y, buildEntityPositionLookups(gameState));
}

export function resolveEntityWithLookups(
  gameState: GameStateSnapshot,
  x: number,
  y: number,
  lookups: EntityPositionLookups,
): CellEntity | null {
  const isPlayer = Boolean(gameState.player && gameState.player.x === x && gameState.player.y === y);
  if (isPlayer) {
    const energyText =
      typeof gameState.player?.energy === "number" && Number.isFinite(gameState.player.energy)
        ? String(Math.max(0, Math.round(gameState.player.energy)))
        : "@";

    return {
      kind: "player",
      label: "Player",
      token: energyText,
      accent: "player",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  const key = keyOf(x, y);
  const enemyStack = lookups.enemyGroupsByKey.get(key) ?? [];
  const enemy = selectVisibleEnemy(enemyStack);
  if (enemy) {
    const hpRatio =
      enemy.hp !== null && enemy.maxHp !== null && enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : null;
    const nextMoveDirection = predictEnemyNextMoveDirection(gameState, enemy);
    const visual = resolveEnemyVisual(enemy, {
      intentArrow: nextMoveDirection ? intentArrow(nextMoveDirection) : null,
    });
    const totalDamage = sumEnemyDamage(enemyStack);
    const badges = visual.badges.map((badge) =>
      badge.position === "se" && enemyStack.length > 1
        ? {
            ...badge,
            text: String(totalDamage),
            tone: totalDamage > 0 ? "danger" : badge.tone,
          }
        : badge,
    );

    if (enemyStack.length > 1 && !badges.some((badge) => badge.position === "se")) {
      badges.push({
        position: "se",
        text: String(totalDamage),
        tone: totalDamage > 0 ? "danger" : "ghost",
      });
    }

    return {
      kind: "enemy",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio,
      showToken: true,
      useWallSurface: false,
      badges,
      isPortalPromptActive: false,
    };
  }

  const interactive = lookups.interactiveByKey.get(key) ?? null;
  if (interactive) {
    if (isRockInteractive(interactive)) {
      return null;
    }

    const visual = resolveInteractiveVisual(interactive);
    const valueText = interactiveValueText(interactive);

    return {
      kind: "interactive",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio: null,
      showToken: visual.showToken,
      useWallSurface: visual.useWallSurface,
      badges: valueText
        ? [
            {
              position: "se",
              text: valueText,
              tone: "value",
            },
          ]
        : [],
      isPortalPromptActive: false,
    };
  }

  const pickupStacks = buildPickupStacks(lookups.pickupGroupsByKey.get(key) ?? []);
  const primaryPickupStack = pickupStacks[0] ?? null;
  if (primaryPickupStack) {
    const visual = primaryPickupStack.visual;
    const valueText = pickupValueText(primaryPickupStack.totalValue);

    return {
      kind: "pickup",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: valueText
        ? [
            {
              position: "se",
              text: valueText,
              tone: visual.badgeTone,
            },
          ]
        : [],
      isPortalPromptActive: false,
    };
  }

  const trap = lookups.trapByKey.get(key) ?? null;
  if (trap) {
    return {
      kind: "trap",
      label: trap.type,
      token: "^",
      accent: "trap",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  const arrowTrap = lookups.arrowTrapByKey.get(key) ?? null;
  if (arrowTrap) {
    return {
      kind: "arrow-trap",
      label: arrowTrap.type,
      token: "A",
      accent: "trap",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  const portal = lookups.portalByKey.get(key) ?? null;
  if (portal) {
    return {
      kind: "portal",
      label: portal.type,
      token: "O",
      accent: "portal",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      badges: [],
      isPortalPromptActive: false,
    };
  }

  return null;
}
