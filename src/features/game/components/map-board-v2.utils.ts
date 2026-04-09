import type { EnemySnapshot, GameStateSnapshot, MapEntitySnapshot, MoveDirection } from "../game.types";
import { effectiveFogValueAt } from "../game-visibility";
import type { RememberedEntity } from "../runtime/map-entity-memory";
import {
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  getMoveTarget,
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
  trapGroupsByKey: Map<string, MapEntitySnapshot[]>;
  trapByKey: Map<string, MapEntitySnapshot>;
  arrowTrapGroupsByKey: Map<string, MapEntitySnapshot[]>;
  arrowTrapByKey: Map<string, MapEntitySnapshot>;
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
  const arrowTrapGroupsByKey = toGroupedLookup(gameState.arrowTraps);
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

function canEnemyTraverseTile(gameState: GameStateSnapshot, x: number, y: number, canPassThroughWalls: boolean | null) {
  const tile = tileKindAt(gameState, x, y);
  if (tile === "void" || tile === "unknown") return false;
  if (tile === "wall" || tile === "hard-wall") return canPassThroughWalls === true;
  return true;
}

export function predictEnemyNextMoveDirection(
  gameState: GameStateSnapshot,
  enemy: Pick<
    EnemySnapshot,
    "x" | "y" | "type" | "moveCooldown" | "patternDirection" | "patternMovingPositive" | "canPassThroughWalls"
  >,
): MoveDirection | null {
  if (isEnemyAdjacentToPlayer(gameState, enemy.x, enemy.y)) return null;
  if (typeof enemy.moveCooldown === "number" && enemy.moveCooldown > 0) return null;
  if (enemy.type !== "pattern") return null;

  const direction = normalizePatternDirection(enemy.patternDirection);
  if (!direction || enemy.patternMovingPositive === null) return null;

  const delta = patternDirectionDelta(direction, enemy.patternMovingPositive);
  const nextX = enemy.x + delta.dx;
  const nextY = enemy.y + delta.dy;
  if (!canEnemyTraverseTile(gameState, nextX, nextY, enemy.canPassThroughWalls)) return null;

  if (delta.dx === 1) return "right";
  if (delta.dx === -1) return "left";
  if (delta.dy === 1) return "down";
  return "up";
}

export function selectedEnemyIntent(gameState: GameStateSnapshot, enemy: EnemySnapshot) {
  if (isEnemyAdjacentToPlayer(gameState, enemy.x, enemy.y)) {
    return "adjacent attack";
  }

  if (typeof enemy.moveCooldown === "number" && enemy.moveCooldown > 0) {
    return `waiting (${enemy.moveCooldown})`;
  }

  if (enemy.type === "pattern") {
    const nextMove = predictEnemyNextMoveDirection(gameState, enemy);
    return nextMove ? `move ${nextMove}` : "blocked / flip soon";
  }

  if (enemy.type === "stationary") {
    return enemy.isChargingHeavy ? "charged line attack soon" : "stationary";
  }

  if (isGhostEnemyLabels(enemy.type, enemy.spriteType)) {
    return enemy.damage !== null && enemy.damage > 0 ? "danger ghost chase" : "harmless ghost chase";
  }

  if (enemy.hasHeavyHit) {
    return "heavy move";
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
    label: kind === "portal" ? entity.type : entity.type,
  };
}

function sortEnemyStack(enemies: EnemySnapshot[]) {
  return [...enemies].sort((left, right) => {
    const leftScore = isAttackableEnemy(left) ? 1 : 0;
    const rightScore = isAttackableEnemy(right) ? 1 : 0;
    return rightScore - leftScore;
  });
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
      token: "^",
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
  const enemy = lookups.enemyByKey.get(key) ?? null;
  if (enemy) {
    const hpRatio =
      enemy.hp !== null && enemy.maxHp !== null && enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : null;
    const nextMoveDirection = predictEnemyNextMoveDirection(gameState, enemy);
    const visual = resolveEnemyVisual(enemy, {
      intentArrow: nextMoveDirection ? intentArrow(nextMoveDirection) : null,
    });

    return {
      kind: "enemy",
      label: visual.label,
      token: visual.token,
      accent: visual.accent,
      hpRatio,
      showToken: true,
      useWallSurface: false,
      badges: visual.badges,
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
      token: "^",
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
