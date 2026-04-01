import type { EnemySnapshot, GameStateSnapshot, MoveDirection } from "../game.types";
import type { RememberedEntity } from "../runtime/map-entity-memory";
import {
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  getMoveTarget,
  isAttackableEnemy,
  isMoveTargetPassable,
  moveControlOrder,
} from "../game-map";
import { resolveEnemyVisual } from "../map-enemy-visuals";
import { interactiveValueText, isRockInteractive, resolveInteractiveVisual } from "../map-interactive-visuals";
import { pickupValueText, resolvePickupVisual } from "../map-pickup-visuals";
import type {
  CellEntity,
  CellHint,
  FocusOffset,
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
  const value = matrixAt(gameState.fogMask, x, y);
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

export function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
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
  focusRadius: number,
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

  const centerX = gameState.player.x + focusOffset.x;
  const centerY = gameState.player.y + focusOffset.y;
  return {
    minX: centerX - focusRadius,
    maxX: centerX + focusRadius,
    minY: centerY - focusRadius,
    maxY: centerY + focusRadius,
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

  const enemy = findEnemyAtPosition(gameState, x, y);
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

  const interactive = gameState.interactive.find((item) => item.x === x && item.y === y);
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

  const pickup = gameState.pickups.find((item) => item.x === x && item.y === y);
  if (pickup) {
    const visual = resolvePickupVisual(pickup);
    const valueText = pickupValueText(pickup.value);

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

  const trap = gameState.traps.find((item) => item.x === x && item.y === y);
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

  const arrowTrap = gameState.arrowTraps.find((item) => item.x === x && item.y === y);
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

  const portal = gameState.portals.find((item) => item.x === x && item.y === y);
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
