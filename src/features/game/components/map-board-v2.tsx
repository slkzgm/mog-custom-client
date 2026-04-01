import { useMemo, useState } from "react";

import {
  findBreakableInteractiveAtPosition,
  findEnemyAtPosition,
  getMoveTarget,
  isAttackableEnemy,
  isGhostEnemy,
  isMoveTargetPassable,
  moveControlOrder,
} from "../game-map";
import { interactiveValueText, resolveInteractiveVisual } from "../map-interactive-visuals";
import { pickupValueText, resolvePickupVisual } from "../map-pickup-visuals";
import type { GameStateSnapshot, MapEntitySnapshot, MoveDirection } from "../game.types";
import { useEncounterCatalog } from "../runtime/use-encounter-catalog";
import type { RememberedEntity } from "../runtime/map-entity-memory";
import { useMapEntityMemory } from "../runtime/use-map-entity-memory";
import { useMapFogMemory } from "../runtime/use-map-fog-memory";
import { useMapSnapshotProbe } from "../runtime/use-map-snapshot-probe";
import { useMapVisitedCells } from "../runtime/use-map-visited-cells";
import { appConfig } from "../../../app/config";

type FogState = "hidden" | "explored" | "visible" | "remembered";
type TileKind = "wall" | "room" | "corridor" | "unknown" | "void";
type HintKind = "move" | "attack" | "break" | "blocked";
type EntityKind = "player" | "enemy" | "interactive" | "pickup" | "trap" | "arrow-trap" | "portal";

interface MapBoardV2Props {
  gameState: GameStateSnapshot;
  onDirectionalAction?: (direction: MoveDirection) => void | Promise<void>;
  onPassAction?: () => void | Promise<void>;
  isActionLocked?: boolean;
}

interface Viewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface FocusOffset {
  x: number;
  y: number;
}

interface FocusOffsetState {
  offset: FocusOffset;
  turnKey: string;
}

interface CellHint {
  direction: MoveDirection;
  kind: HintKind;
  label: string;
}

interface CellEntity {
  kind: EntityKind;
  label: string;
  token: string;
  accent: string;
  hpRatio: number | null;
  showToken: boolean;
  useWallSurface: boolean;
  valueText: string | null;
  intentDirection: MoveDirection | null;
}

function keyOf(x: number, y: number) {
  return `${x},${y}`;
}

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function fogStateAt(gameState: GameStateSnapshot, x: number, y: number): FogState {
  const value = matrixAt(gameState.fogMask, x, y);
  if (value === 1) return "explored";
  if (typeof value === "number" && value >= 2) return "visible";
  return "hidden";
}

function tileKindAt(gameState: GameStateSnapshot, x: number, y: number): TileKind {
  if (x < 0 || y < 0) return "void";
  const value = matrixAt(gameState.mapData, x, y);
  if (value === null) return "void";
  if (value === 2) return "wall";
  if (value === 1) return "room";
  if (value === 0) return "corridor";
  return "unknown";
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function isSkullEnemySprite(spriteType: string | null) {
  if (!spriteType) return false;
  const normalized = spriteType.trim().toLowerCase();
  return normalized.includes("skeleton") || normalized.includes("skull");
}

function isGhostEnemyLabels(type: string, spriteType: string | null) {
  const normalizedType = type.trim().toLowerCase();
  const normalizedSprite = spriteType?.trim().toLowerCase() ?? "";
  return normalizedType.includes("ghost") || normalizedSprite.includes("ghost");
}

function intentArrow(direction: MoveDirection) {
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
  if (tile === "wall") return canPassThroughWalls === true;
  return true;
}

function predictEnemyNextMoveDirection(
  gameState: GameStateSnapshot,
  enemy: {
    x: number;
    y: number;
    type: string;
    moveCooldown: number | null;
    patternDirection: string | null;
    patternMovingPositive: boolean | null;
    canPassThroughWalls: boolean | null;
  },
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

function selectedEnemyIntent(gameState: GameStateSnapshot, enemy: {
  x: number;
  y: number;
  type: string;
  damage: number | null;
  moveCooldown: number | null;
  patternDirection: string | null;
  patternMovingPositive: boolean | null;
  canPassThroughWalls: boolean | null;
  isChargingHeavy: boolean;
  hasHeavyHit: boolean;
  spriteType: string | null;
}) {
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

function buildViewport(
  gameState: GameStateSnapshot,
  mode: "focus" | "full",
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

function buildHints(gameState: GameStateSnapshot): Map<string, CellHint> {
  const hints = new Map<string, CellHint>();
  if (!gameState.player) return hints;

  for (const control of moveControlOrder) {
    const target = getMoveTarget(gameState, control.direction);
    if (!target) continue;

    const enemy = findEnemyAtPosition(gameState, target.targetX, target.targetY);
    if (enemy) {
      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        kind: isAttackableEnemy(enemy) ? "attack" : "blocked",
        label: isAttackableEnemy(enemy) ? "Attack" : "Blocked",
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

    hints.set(keyOf(target.targetX, target.targetY), {
      direction: control.direction,
      kind: isMoveTargetPassable(gameState, target.targetX, target.targetY) ? "move" : "blocked",
      label: isMoveTargetPassable(gameState, target.targetX, target.targetY) ? "Move" : "Blocked",
    });
  }

  return hints;
}

function toLookup<T extends { x: number; y: number }>(items: T[]) {
  const lookup = new Map<string, T>();
  for (const item of items) {
    lookup.set(keyOf(item.x, item.y), item);
  }
  return lookup;
}

function pickupToken(entity: MapEntitySnapshot) {
  const visual = resolvePickupVisual(entity);
  return {
    token: visual.token,
    accent: visual.accent,
    label: visual.label,
    valueText: pickupValueText(entity.value),
  };
}

function rememberedEntityToCellEntity(entity: RememberedEntity): CellEntity | null {
  if (entity.kind === "interactive") {
    const token = resolveInteractiveVisual(entity.type);
    return {
      kind: "interactive",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
      showToken: token.showToken,
      useWallSurface: token.useWallSurface,
      valueText: interactiveValueText(entity),
      intentDirection: null,
    };
  }

  if (entity.kind === "pickup") {
    const token = {
      ...resolvePickupVisual(entity.type),
      valueText: pickupValueText(entity.value),
    };
    return {
      kind: "pickup",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      valueText: token.valueText,
      intentDirection: null,
    };
  }

  if (entity.kind === "trap") {
    return {
      kind: "trap",
      label: entity.type,
      token: "^",
      accent: "trap",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      valueText: null,
      intentDirection: null,
    };
  }

  if (entity.kind === "arrow-trap") {
    return {
      kind: "arrow-trap",
      label: entity.type,
      token: "^",
      accent: "trap",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      valueText: null,
      intentDirection: null,
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
      valueText: null,
      intentDirection: null,
    };
  }

  return null;
}

function resolveEntity(gameState: GameStateSnapshot, x: number, y: number): CellEntity | null {
  const isPlayer = Boolean(gameState.player && gameState.player.x === x && gameState.player.y === y);
  if (isPlayer) {
    return {
      kind: "player",
      label: "Player",
      token: "@",
      accent: "player",
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      valueText: null,
      intentDirection: null,
    };
  }

  const enemy = findEnemyAtPosition(gameState, x, y);
  if (enemy) {
    const ratio =
      enemy.hp !== null && enemy.maxHp !== null && enemy.maxHp > 0 ? Math.max(0, Math.min(1, enemy.hp / enemy.maxHp)) : null;
    return {
      kind: "enemy",
      label: isGhostEnemy(enemy) ? "Ghost" : enemy.type,
      token: isGhostEnemy(enemy) ? "G" : "!",
      accent: isGhostEnemy(enemy) ? (enemy.damage !== null && enemy.damage > 0 ? "ghost-danger" : "ghost") : "enemy",
      hpRatio: ratio,
      showToken: true,
      useWallSurface: false,
      valueText: null,
      intentDirection: predictEnemyNextMoveDirection(gameState, enemy),
    };
  }

  const interactive = gameState.interactive.find((item) => item.x === x && item.y === y);
  if (interactive) {
    const token = resolveInteractiveVisual(interactive);
    return {
      kind: "interactive",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
      showToken: token.showToken,
      useWallSurface: token.useWallSurface,
      valueText: interactiveValueText(interactive),
      intentDirection: null,
    };
  }

  const pickup = gameState.pickups.find((item) => item.x === x && item.y === y);
  if (pickup) {
    const token = pickupToken(pickup);
    return {
      kind: "pickup",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
      showToken: true,
      useWallSurface: false,
      valueText: token.valueText,
      intentDirection: null,
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
      valueText: null,
      intentDirection: null,
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
      valueText: null,
      intentDirection: null,
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
      valueText: null,
      intentDirection: null,
    };
  }

  return null;
}

export function MapBoardV2({
  gameState,
  onDirectionalAction,
  onPassAction,
  isActionLocked = false,
}: MapBoardV2Props) {
  const [viewMode, setViewMode] = useState<"focus" | "full">("focus");
  const [focusRadius, setFocusRadius] = useState(6);
  const currentTurnKey = `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}:${gameState.turnNumber ?? "?"}`;
  const [focusOffsetState, setFocusOffsetState] = useState<FocusOffsetState>({
    offset: { x: 0, y: 0 },
    turnKey: currentTurnKey,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isEncounterCatalogEnabled = appConfig.features.encounterCatalog;
  const isMapFogMemoryEnabled = appConfig.features.mapFogMemory;
  const isMapSnapshotProbeEnabled = appConfig.features.mapSnapshotProbe;
  const isMapVisitedCellsEnabled = appConfig.features.mapVisitedCells;
  const encounterCatalog = useEncounterCatalog(gameState, isEncounterCatalogEnabled);
  const entityMemory = useMapEntityMemory(gameState, isMapFogMemoryEnabled);
  const fogMemory = useMapFogMemory(gameState, isMapFogMemoryEnabled);
  const mapSnapshotProbe = useMapSnapshotProbe(gameState, isMapSnapshotProbeEnabled);
  const visitedCells = useMapVisitedCells(gameState, isMapVisitedCellsEnabled);

  const effectiveFocusOffset = useMemo(
    () => (focusOffsetState.turnKey === currentTurnKey ? focusOffsetState.offset : { x: 0, y: 0 }),
    [currentTurnKey, focusOffsetState.offset, focusOffsetState.turnKey],
  );
  const viewport = useMemo(
    () => buildViewport(gameState, viewMode, focusRadius, effectiveFocusOffset),
    [effectiveFocusOffset, focusRadius, gameState, viewMode],
  );
  const hintsByKey = useMemo(() => buildHints(gameState), [gameState]);
  const enemyLookup = useMemo(() => toLookup(gameState.enemies), [gameState.enemies]);
  const focusWindowSize = focusRadius * 2 + 1;

  const panFocus = (deltaX: number, deltaY: number) => {
    setFocusOffsetState((current) => ({
      turnKey: currentTurnKey,
      offset: {
        x: (current.turnKey === currentTurnKey ? current.offset.x : 0) + deltaX,
        y: (current.turnKey === currentTurnKey ? current.offset.y : 0) + deltaY,
      },
    }));
  };

  const resetFocusOffset = () => {
    setFocusOffsetState({
      offset: { x: 0, y: 0 },
      turnKey: currentTurnKey,
    });
  };

  const xValues = useMemo(() => {
    if (viewport.maxX < viewport.minX) return [];
    return Array.from({ length: viewport.maxX - viewport.minX + 1 }, (_, index) => viewport.minX + index);
  }, [viewport]);

  const yValues = useMemo(() => {
    if (viewport.maxY < viewport.minY) return [];
    return Array.from({ length: viewport.maxY - viewport.minY + 1 }, (_, index) => viewport.minY + index);
  }, [viewport]);

  const fallbackKey = gameState.player ? keyOf(gameState.player.x, gameState.player.y) : null;
  const activeSelectedKey = selectedKey ?? fallbackKey;
  const selectedEnemy = activeSelectedKey ? enemyLookup.get(activeSelectedKey) ?? null : null;
  const selectedEnemyNextMoveDirection = useMemo(
    () => (selectedEnemy ? predictEnemyNextMoveDirection(gameState, selectedEnemy) : null),
    [gameState, selectedEnemy],
  );
  const selectedEnemyIntentText = useMemo(
    () => (selectedEnemy ? selectedEnemyIntent(gameState, selectedEnemy) : null),
    [gameState, selectedEnemy],
  );

  if (!xValues.length || !yValues.length) {
    return <p>No map data available.</p>;
  }

  return (
    <div className="map2-shell">
      <div className="map2-controls">
        <div className="map2-control-stack">
          <div className="map2-segmented">
            <button type="button" onClick={() => setViewMode("focus")} disabled={viewMode === "focus"}>
              Focus
            </button>
            <button type="button" onClick={() => setViewMode("full")} disabled={viewMode === "full"}>
              Full
            </button>
          </div>

          {viewMode === "focus" ? (
            <>
              <div className="map2-toolbar">
                <button type="button" onClick={() => setFocusRadius((current) => clamp(current - 1, 3, 16))} title="Zoom in">
                  -
                </button>
                <button type="button" className="map2-toolbar-value" disabled title="Focus window">
                  {focusWindowSize}x{focusWindowSize}
                </button>
                <button type="button" onClick={() => setFocusRadius((current) => clamp(current + 1, 3, 16))} title="Zoom out">
                  +
                </button>
                <button type="button" onClick={resetFocusOffset} title="Center on player">
                  Reset
                </button>
              </div>

              <div className="map2-dpad">
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => panFocus(0, -2)} title="Pan up">
                  Up
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => panFocus(-2, 0)} title="Pan left">
                  Left
                </button>
                <button type="button" onClick={resetFocusOffset} title="Reset focus center">
                  Home
                </button>
                <button type="button" onClick={() => panFocus(2, 0)} title="Pan right">
                  Right
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => panFocus(0, 2)} title="Pan down">
                  Down
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="map2-stage">
        <div className="map2-board">
          <div className="map2-grid" style={{ gridTemplateColumns: `repeat(${xValues.length}, var(--map2-cell-size, 56px))` }}>
            {yValues.flatMap((y) =>
              xValues.map((x) => {
                const key = keyOf(x, y);
                const currentFog = fogStateAt(gameState, x, y);
                const isRemembered = currentFog !== "visible" && fogMemory.rememberedCoordinates.has(key);
                const fog = isRemembered ? "remembered" : currentFog;
                const tile = tileKindAt(gameState, x, y);
                const currentEntity = resolveEntity(gameState, x, y);
                const rememberedEntity = entityMemory.rememberedEntities.get(key);
                const isVisited = visitedCells.visitedCoordinates.has(key);
                const rawEntity =
                  currentEntity ?? (rememberedEntity && currentFog !== "visible" ? rememberedEntityToCellEntity(rememberedEntity) : null);
                const entity =
                  rawEntity && rawEntity.kind === "interactive" && rawEntity.accent === "fountain" && isVisited
                    ? { ...rawEntity, accent: "fountain-spent", label: "Fountain (spent)" }
                    : rawEntity;
                const hint = hintsByKey.get(key) ?? null;
                const isSelected = key === activeSelectedKey;
                const isPlayerTile = Boolean(gameState.player && gameState.player.x === x && gameState.player.y === y);
                const canSkip = isPlayerTile && onPassAction && !isActionLocked;
                const canUseHint = Boolean(hint && hint.kind !== "blocked" && onDirectionalAction && !isActionLocked);

                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "map2-cell",
                      `map2-cell-${entity?.useWallSurface ? "wall" : tile}`,
                      `map2-fog-${fog}`,
                      isVisited ? "map2-cell-visited" : "",
                      entity ? `map2-entity-${entity.accent}` : "",
                      hint ? `map2-hint-${hint.kind}` : "",
                      isSelected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setSelectedKey(key);
                      if (canSkip) {
                        void onPassAction?.();
                        return;
                      }
                      if (canUseHint && hint) {
                        void onDirectionalAction?.(hint.direction);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelectedKey(key);
                    }}
                    title={`(${x},${y}) ${tile} ${entity?.label ?? ""}`.trim()}
                  >
                    <span className="map2-cell-base" />
                    {fog !== "hidden" ? <span className="map2-cell-pattern" /> : null}
                    {entity && entity.showToken && fog !== "hidden" ? (
                      <span className="map2-token">
                        <span className="map2-token-core">{entity.token}</span>
                      </span>
                    ) : null}
                    {entity?.intentDirection && fog !== "hidden" ? (
                      <span className={`map2-intent-arrow map2-intent-arrow-${entity.intentDirection}`}>
                        {intentArrow(entity.intentDirection)}
                      </span>
                    ) : null}
                    {entity?.valueText && fog !== "hidden" ? <span className="map2-token-badge">{entity.valueText}</span> : null}
                    {entity && fog !== "hidden" && entity.hpRatio !== null ? (
                      <span className="map2-health">
                        <span
                          className="map2-health-fill"
                          style={{ width: `${Math.max(10, Math.round(entity.hpRatio * 100))}%` }}
                        />
                      </span>
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <aside className="map2-sidebar">
          {isMapVisitedCellsEnabled ? (
            <div className="map2-card">
              <div className="map2-card-header">
                <div>
                  <p className="panel-eyebrow">Pathing</p>
                  <h3>Visited cells</h3>
                </div>
                <span className="map2-verdict-pill map2-verdict-pill-likely-global">active</span>
              </div>
              <div className="map2-kv">
                <span>Visited tiles</span>
                <strong>{visitedCells.visitedCount}</strong>
              </div>
              <div className="map2-kv">
                <span>Stored floors</span>
                <strong>{visitedCells.visitedFloorCount}</strong>
              </div>
              <p className="map2-card-note">
                A subtle trail marks the cells you already crossed so backtracking is easier and safer around hidden traps.
              </p>
              <div className="panel-actions">
                <button type="button" onClick={visitedCells.resetCurrentFloor}>
                  Reset floor trail
                </button>
                <button type="button" onClick={visitedCells.resetAll}>
                  Reset all trail
                </button>
              </div>
            </div>
          ) : null}

          {viewMode === "focus" ? (
            <div className="map2-card">
              <p className="panel-eyebrow">Focus</p>
              <div className="map2-kv">
                <span>Window</span>
                <strong>
                  {focusWindowSize}x{focusWindowSize}
                </strong>
              </div>
              <div className="map2-kv">
                <span>Offset</span>
                <strong>
                  {effectiveFocusOffset.x}, {effectiveFocusOffset.y}
                </strong>
              </div>
              <p className="map2-card-note">Zoom widens the focus window. Pan buttons only offset the current turn view; after a move, focus snaps back on the player.</p>
            </div>
          ) : null}

          <div className="map2-card">
            <p className="panel-eyebrow">Player</p>
            <div className="map2-kv">
              <span>Floor</span>
              <strong>{gameState.currentFloor ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>Turn</span>
              <strong>{gameState.turnNumber ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>Energy</span>
              <strong>{gameState.player?.energy ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>Treasure</span>
              <strong>{gameState.player?.treasure ?? "-"}</strong>
            </div>
          </div>

          <div className="map2-card">
            <p className="panel-eyebrow">Tile</p>
            <div className="map2-kv">
              <span>Selected</span>
              <strong>{activeSelectedKey ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>Enemy</span>
              <strong>{selectedEnemy?.type ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>HP</span>
              <strong>
                {selectedEnemy && selectedEnemy.hp !== null && selectedEnemy.maxHp !== null
                  ? `${selectedEnemy.hp}/${selectedEnemy.maxHp}`
                  : selectedEnemy?.hp ?? "-"}
              </strong>
            </div>
            {selectedEnemy ? (
              <>
                <div className="map2-kv">
                  <span>Sprite</span>
                  <strong>{selectedEnemy.spriteType ?? "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Behavior</span>
                  <strong>{selectedEnemy.type}</strong>
                </div>
                <div className="map2-kv">
                  <span>Damage</span>
                  <strong>{selectedEnemy.damage ?? "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Cooldown</span>
                  <strong>{selectedEnemy.moveCooldown ?? "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Pattern dir</span>
                  <strong>{selectedEnemy.patternDirection ?? "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Pattern sign</span>
                  <strong>
                    {selectedEnemy.patternMovingPositive === null
                      ? "-"
                      : selectedEnemy.patternMovingPositive
                        ? "positive"
                        : "negative"}
                  </strong>
                </div>
                <div className="map2-kv">
                  <span>Ghost / Skull</span>
                  <strong>
                    {isGhostEnemy(selectedEnemy) ? "ghost" : "normal"} / {isSkullEnemySprite(selectedEnemy.spriteType) ? "skull" : "non-skull"}
                  </strong>
                </div>
                <div className="map2-kv">
                  <span>Intent</span>
                  <strong>{selectedEnemyIntentText ?? "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Next move</span>
                  <strong>{selectedEnemyNextMoveDirection ? intentArrow(selectedEnemyNextMoveDirection) : "-"}</strong>
                </div>
                <div className="map2-kv">
                  <span>Pass walls</span>
                  <strong>
                    {selectedEnemy.canPassThroughWalls === null ? "-" : selectedEnemy.canPassThroughWalls ? "yes" : "no"}
                  </strong>
                </div>
                <div className="map2-kv">
                  <span>Heavy / Charging</span>
                  <strong>
                    {selectedEnemy.hasHeavyHit ? "yes" : "no"} / {selectedEnemy.isChargingHeavy ? "yes" : "no"}
                  </strong>
                </div>
                <div className="map2-kv">
                  <span>Attackable</span>
                  <strong>{isAttackableEnemy(selectedEnemy) ? "yes" : "no"}</strong>
                </div>
              </>
            ) : null}
          </div>

          {isMapFogMemoryEnabled ? (
            <div className="map2-card">
              <div className="map2-card-header">
                <div>
                  <p className="panel-eyebrow">Memory</p>
                  <h3>Fog memory</h3>
                </div>
                <span className="map2-verdict-pill map2-verdict-pill-likely-global">active</span>
              </div>
              <div className="map2-kv">
                <span>Remembered tiles</span>
                <strong>{fogMemory.rememberedCount}</strong>
              </div>
              <div className="map2-kv">
                <span>Remembered entities</span>
                <strong>{entityMemory.rememberedCount}</strong>
              </div>
              <div className="map2-kv">
                <span>Stored floors</span>
                <strong>{fogMemory.rememberedFloorCount}</strong>
              </div>
              <p className="map2-card-note">
                Terrain and static entities you saw once stay readable locally, until the server later confirms they are gone.
              </p>
              <div className="panel-actions">
                <button
                  type="button"
                  onClick={() => {
                    fogMemory.resetCurrentFloor();
                    entityMemory.resetCurrentFloor();
                  }}
                >
                  Reset floor memory
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fogMemory.resetAll();
                    entityMemory.resetAll();
                  }}
                >
                  Reset all memory
                </button>
              </div>
            </div>
          ) : null}

          {isEncounterCatalogEnabled ? (
            <div className="map2-card">
              <div className="map2-card-header">
                <div>
                  <p className="panel-eyebrow">Catalog</p>
                  <h3>Encountered entities</h3>
                </div>
                <span className={`map2-sync-pill map2-sync-pill-${encounterCatalog.syncState}`}>{encounterCatalog.syncState}</span>
              </div>
              <div className="map2-kv">
                <span>Variants</span>
                <strong>{encounterCatalog.summary.totalVariants}</strong>
              </div>
              <div className="map2-kv">
                <span>Sightings</span>
                <strong>{encounterCatalog.summary.totalSightings}</strong>
              </div>
              <p className="map2-card-note">
                {encounterCatalog.devFilePath
                  ? `Dev file: ${encounterCatalog.devFilePath}`
                  : "Stored locally in the browser while you explore."}
              </p>

              <div className="map2-entity-groups">
                {encounterCatalog.summary.groups.map((group) => (
                  <details key={group.category} className="map2-entity-group" open={group.entries.length > 0}>
                    <summary>
                      {group.label} <span>{group.entries.length}</span>
                    </summary>
                    {group.entries.length > 0 ? (
                      <div className="map2-entity-list">
                        {group.entries.map((entry) => (
                          <article key={`${group.category}:${entry.key}`} className="map2-entity-row">
                            <div className="map2-entity-row-main">
                              <strong>{entry.displayName}</strong>
                              <span>{entry.sightings}x</span>
                            </div>
                            <p className="map2-entity-row-meta">
                              floors {entry.floors.length > 0 ? entry.floors.join(", ") : "-"}
                              {entry.sampleSpriteTypes.length > 0 ? ` | sprites ${entry.sampleSpriteTypes.join(", ")}` : ""}
                              {entry.sampleValues.length > 0 ? ` | values ${entry.sampleValues.join(", ")}` : ""}
                              {entry.sampleDamage.length > 0 ? ` | dmg ${entry.sampleDamage.join(", ")}` : ""}
                              {entry.sampleTileIndices.length > 0 ? ` | tiles ${entry.sampleTileIndices.join(", ")}` : ""}
                              {entry.isRevealedStates.length > 0
                                ? ` | revealed ${entry.isRevealedStates
                                    .map((state) => (state === null ? "unknown" : state ? "yes" : "no"))
                                    .join(", ")}`
                                : ""}
                            </p>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="map2-empty-state">None seen yet.</p>
                    )}
                  </details>
                ))}
              </div>
            </div>
          ) : null}

          {isMapSnapshotProbeEnabled ? (
            <div className="map2-card">
              <div className="map2-card-header">
                <div>
                  <p className="panel-eyebrow">Probe</p>
                  <h3>Map snapshot check</h3>
                </div>
                <span className={`map2-verdict-pill map2-verdict-pill-${mapSnapshotProbe.probeState.verdict}`}>
                  {mapSnapshotProbe.probeState.verdict}
                </span>
              </div>
              <div className="map2-kv">
                <span>Snapshots</span>
                <strong>{mapSnapshotProbe.probeState.summary.snapshots}</strong>
              </div>
              <div className="map2-kv">
                <span>Tracked tiles</span>
                <strong>{mapSnapshotProbe.probeState.summary.trackedTiles}</strong>
              </div>
              <div className="map2-kv">
                <span>Stable matches</span>
                <strong>{mapSnapshotProbe.probeState.summary.stableMatches}</strong>
              </div>
              <div className="map2-kv">
                <span>Tile conflicts</span>
                <strong>{mapSnapshotProbe.probeState.summary.tileConflicts}</strong>
              </div>
              <div className="map2-kv">
                <span>Dim changes / OOB</span>
                <strong>
                  {mapSnapshotProbe.probeState.summary.dimensionChangesWithinFloor} / {mapSnapshotProbe.probeState.summary.playerOutOfBounds}
                </strong>
              </div>
              <div className="panel-actions">
                <button type="button" onClick={mapSnapshotProbe.reset}>
                  Reset probe
                </button>
              </div>
              <div className="map2-probe-notes">
                {mapSnapshotProbe.probeState.notes.map((note) => (
                  <p key={note} className="map2-empty-state">
                    {note}
                  </p>
                ))}
              </div>
              <details className="map2-entity-group">
                <summary>Recent snapshots</summary>
                <div className="map2-probe-list">
                  {[...mapSnapshotProbe.probeState.observations].reverse().map((entry) => (
                    <article key={entry.snapshotKey} className="map2-entity-row">
                      <div className="map2-entity-row-main">
                        <strong>
                          f{entry.currentFloor ?? "?"} t{entry.turnNumber ?? "?"}
                        </strong>
                        <span>
                          {entry.mapWidth}x{entry.mapHeight}
                        </span>
                      </div>
                      <p className="map2-entity-row-meta">
                        player {entry.playerX ?? "-"}, {entry.playerY ?? "-"} | in bounds{" "}
                        {entry.playerInBounds === null ? "-" : entry.playerInBounds ? "yes" : "no"} | visible {entry.visibleCount} |
                        explored {entry.exploredCount} | hidden {entry.hiddenCount}
                      </p>
                      <p className="map2-entity-row-meta">
                        tracked {entry.trackedTilesAfterSnapshot} | stable {entry.stableMatchesThisSnapshot} | conflicts{" "}
                        {entry.tileConflictsThisSnapshot} | dim changed {entry.dimensionChangedWithinFloor ? "yes" : "no"}
                      </p>
                    </article>
                  ))}
                </div>
              </details>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
