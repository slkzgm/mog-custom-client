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
import { interactiveSymbol } from "../map-interactive-visuals";
import type { EnemySnapshot, GameStateSnapshot, MapEntitySnapshot, MoveDirection } from "../game.types";

type FogState = "hidden" | "explored" | "visible";
type CellHintType = "attack" | "break" | "move" | "blocked";
type CellEntityKind = "player" | "enemy" | "interactive" | "pickup" | "trap" | "arrow-trap" | "portal";

type MapLookup<T> = Map<string, T>;

interface CellHint {
  direction: MoveDirection;
  type: CellHintType;
  label: string;
}

interface CellInspectorData {
  x: number;
  y: number;
  fog: FogState;
  tileValue: number | null;
  tileDataValue: number | null;
  tileLabel: string;
  entityKind: CellEntityKind | null;
  entityType: string | null;
  entityId: string | null;
  enemyHp: string | null;
  badges: string[];
  isPlayerCell: boolean;
  hint: CellHint | null;
}

interface Viewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface MapBoardProps {
  gameState: GameStateSnapshot;
  onDirectionalAction?: (direction: MoveDirection) => void | Promise<void>;
  onPassAction?: () => void | Promise<void>;
  isActionLocked?: boolean;
  variant?: "default" | "immersive";
}

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function toLookup<T extends { x: number; y: number }>(items: T[]): MapLookup<T> {
  const lookup: MapLookup<T> = new Map();
  for (const item of items) {
    lookup.set(keyOf(item.x, item.y), item);
  }
  return lookup;
}

function asTwoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function tileLabel(tile: number | null): string {
  if (tile === 0) return "corridor";
  if (tile === 1) return "room";
  if (tile === 2) return "wall";
  return "unknown";
}

function tileSymbol(tile: number | null): string {
  if (tile === 0) return ":";
  if (tile === 1) return ".";
  if (tile === 2) return "#";
  return "?";
}

function fogLabel(value: number | null): FogState {
  if (value === 1) return "explored";
  if (typeof value === "number" && value >= 2) return "visible";
  return "hidden";
}

function directionArrow(direction: MoveDirection): string {
  if (direction === "up") return "U";
  if (direction === "down") return "D";
  if (direction === "left") return "L";
  return "R";
}

function shortIdBadge(id: string | null): string | null {
  if (!id) return null;
  const match = id.match(/_(\d+)$/);
  if (match) return `#${match[1]}`;
  return id.length > 6 ? id.slice(-6) : id;
}

function shortTypeCode(type: string | null): string {
  if (!type) return "-";
  const normalized = type.trim().toLowerCase();
  if (!normalized) return "-";
  if (normalized.length <= 3) return normalized;
  const words = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`;
  }
  return normalized.slice(0, 3);
}

function pickupBadge(entity: MapEntitySnapshot): string {
  const value = entity.value;
  const type = entity.type.trim().toLowerCase();
  if (type.includes("energy")) return `e+${value ?? "?"}`;
  if (type.includes("treasure")) return `t+${value ?? "?"}`;
  if (type.includes("marble")) return `m+${value ?? "?"}`;
  if (type.includes("hongbao")) return `h+${value ?? "?"}`;
  return value !== null ? `${shortTypeCode(type)}+${value}` : shortTypeCode(type);
}

function clampRatio(value: number | null, maxValue: number | null): number | null {
  if (value === null || maxValue === null || maxValue <= 0) return null;
  return Math.max(0, Math.min(1, value / maxValue));
}

function entityTokenSymbol(kind: CellEntityKind | null, symbol: string): string {
  if (kind === "player") return "@";
  if (kind === "enemy") return symbol === "G" ? "G" : "!";
  if (kind === "interactive") return symbol;
  if (kind === "pickup") return "+";
  if (kind === "trap" || kind === "arrow-trap") return "^";
  if (kind === "portal") return "O";
  return symbol;
}

function tileAccentClass(tile: number | null): string {
  if (tile === 2) return "map-cell-accent-wall";
  if (tile === 1) return "map-cell-accent-room";
  if (tile === 0) return "map-cell-accent-corridor";
  return "map-cell-accent-unknown";
}

function buildViewport(gameState: GameStateSnapshot, mode: "focus" | "full"): Viewport {
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;

  if (mapWidth === 0 || mapHeight === 0) {
    return {
      minX: 0,
      maxX: -1,
      minY: 0,
      maxY: -1,
    };
  }

  if (mode === "full" || !gameState.player) {
    return {
      minX: 0,
      maxX: mapWidth - 1,
      minY: 0,
      maxY: mapHeight - 1,
    };
  }

  const radius = 8;
  const minX = Math.max(0, gameState.player.x - radius);
  const maxX = Math.min(mapWidth - 1, gameState.player.x + radius);
  const minY = Math.max(0, gameState.player.y - radius);
  const maxY = Math.min(mapHeight - 1, gameState.player.y + radius);

  return {
    minX,
    maxX,
    minY,
    maxY,
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
      if (!isAttackableEnemy(enemy)) {
        hints.set(keyOf(target.targetX, target.targetY), {
          direction: control.direction,
          type: "blocked",
          label: enemy.id ? `Ghost ${enemy.id} (cannot attack)` : "Ghost (cannot attack)",
        });
        continue;
      }

      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        type: "attack",
        label: enemy.id ? `Attack ${enemy.id}` : "Attack enemy",
      });
      continue;
    }

    const interactive = findBreakableInteractiveAtPosition(gameState, target.targetX, target.targetY);
    if (interactive) {
      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        type: "break",
        label: interactive.id ? `Break ${interactive.id}` : `Break ${interactive.type}`,
      });
      continue;
    }

    if (isMoveTargetPassable(gameState, target.targetX, target.targetY)) {
      hints.set(keyOf(target.targetX, target.targetY), {
        direction: control.direction,
        type: "move",
        label: `Move to (${target.targetX},${target.targetY})`,
      });
      continue;
    }

    hints.set(keyOf(target.targetX, target.targetY), {
      direction: control.direction,
      type: "blocked",
      label: `Blocked (${target.targetX},${target.targetY})`,
    });
  }

  return hints;
}

function resolveEntityData(params: {
  key: string;
  isPlayerCell: boolean;
  playerEnergy: number | null | undefined;
  enemiesByKey: MapLookup<EnemySnapshot>;
  interactiveByKey: MapLookup<MapEntitySnapshot>;
  pickupsByKey: MapLookup<MapEntitySnapshot>;
  trapsByKey: MapLookup<MapEntitySnapshot>;
  arrowTrapsByKey: MapLookup<MapEntitySnapshot>;
  portalsByKey: MapLookup<MapEntitySnapshot>;
}): {
  symbol: string;
  entityKind: CellEntityKind | null;
  entityType: string | null;
  entityId: string | null;
  enemyHp: string | null;
  badges: string[];
} {
  if (params.isPlayerCell) {
    const energy = params.playerEnergy;
    const badges = typeof energy === "number" ? [`e:${energy}`] : [];
    return {
      symbol: "@",
      entityKind: "player",
      entityType: "player",
      entityId: "player",
      enemyHp: null,
      badges,
    };
  }

  const enemy = params.enemiesByKey.get(params.key);
  if (enemy) {
    const hpBadge = enemy.hp !== null ? `hp:${enemy.hp}` : null;
    const damageBadge = enemy.damage !== null ? `d:${enemy.damage}` : null;
    const ghost = isGhostEnemy(enemy);
    const ghostBadge = ghost ? "ghost" : null;
    const typeBadge = ghost ? null : shortTypeCode(enemy.type);
    return {
      symbol: ghost ? "G" : "E",
      entityKind: "enemy",
      entityType: enemy.type,
      entityId: enemy.id,
      enemyHp:
        enemy.hp !== null && enemy.maxHp !== null
          ? `${enemy.hp}/${enemy.maxHp}`
          : enemy.hp !== null
            ? String(enemy.hp)
            : enemy.maxHp !== null
              ? `?/${enemy.maxHp}`
              : null,
      badges: [hpBadge, damageBadge, ghostBadge, typeBadge].filter((value): value is string => Boolean(value)),
    };
  }

  const interactive = params.interactiveByKey.get(params.key);
  if (interactive) {
    const typeBadge = shortTypeCode(interactive.type);
    const idBadge = shortIdBadge(interactive.id);
    return {
      symbol: interactiveSymbol(interactive),
      entityKind: "interactive",
      entityType: interactive.type,
      entityId: interactive.id,
      enemyHp: null,
      badges: [typeBadge, idBadge].filter((value): value is string => Boolean(value)),
    };
  }

  const pickup = params.pickupsByKey.get(params.key);
  if (pickup) {
    const valueBadge = pickupBadge(pickup);
    const idBadge = shortIdBadge(pickup.id);
    return {
      symbol: "$",
      entityKind: "pickup",
      entityType: pickup.type,
      entityId: pickup.id,
      enemyHp: null,
      badges: [valueBadge, idBadge].filter((value): value is string => Boolean(value)),
    };
  }

  const trap = params.trapsByKey.get(params.key);
  if (trap) {
    const damageBadge = trap.damage !== null ? `d:${trap.damage}` : shortTypeCode(trap.type);
    const idBadge = shortIdBadge(trap.id);
    return {
      symbol: "^",
      entityKind: "trap",
      entityType: trap.type,
      entityId: trap.id,
      enemyHp: null,
      badges: [damageBadge, idBadge].filter((value): value is string => Boolean(value)),
    };
  }

  const arrowTrap = params.arrowTrapsByKey.get(params.key);
  if (arrowTrap) {
    const damageBadge = arrowTrap.damage !== null ? `d:${arrowTrap.damage}` : shortTypeCode(arrowTrap.type);
    const idBadge = shortIdBadge(arrowTrap.id);
    return {
      symbol: "A",
      entityKind: "arrow-trap",
      entityType: arrowTrap.type,
      entityId: arrowTrap.id,
      enemyHp: null,
      badges: [damageBadge, idBadge].filter((value): value is string => Boolean(value)),
    };
  }

  const portal = params.portalsByKey.get(params.key);
  if (portal) {
    const idBadge = shortIdBadge(portal.id);
    return {
      symbol: "O",
      entityKind: "portal",
      entityType: portal.type,
      entityId: portal.id,
      enemyHp: null,
      badges: [idBadge].filter((value): value is string => Boolean(value)),
    };
  }

  return {
    symbol: "",
    entityKind: null,
    entityType: null,
    entityId: null,
    enemyHp: null,
    badges: [],
  };
}

export function MapBoard({
  gameState,
  onDirectionalAction,
  onPassAction,
  isActionLocked = false,
  variant = "default",
}: MapBoardProps) {
  const [viewMode, setViewMode] = useState<"focus" | "full">("focus");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isImmersive = variant === "immersive";

  const viewport = useMemo(() => buildViewport(gameState, viewMode), [gameState, viewMode]);
  const hintsByKey = useMemo(() => buildHints(gameState), [gameState]);

  const enemiesByKey = useMemo(() => toLookup(gameState.enemies), [gameState.enemies]);
  const interactiveByKey = useMemo(() => toLookup(gameState.interactive), [gameState.interactive]);
  const pickupsByKey = useMemo(() => toLookup(gameState.pickups), [gameState.pickups]);
  const trapsByKey = useMemo(() => toLookup(gameState.traps), [gameState.traps]);
  const arrowTrapsByKey = useMemo(() => toLookup(gameState.arrowTraps), [gameState.arrowTraps]);
  const portalsByKey = useMemo(() => toLookup(gameState.portals), [gameState.portals]);

  const xValues = useMemo(() => {
    if (viewport.maxX < viewport.minX) return [];
    return Array.from({ length: viewport.maxX - viewport.minX + 1 }, (_, offset) => viewport.minX + offset);
  }, [viewport]);

  const yValues = useMemo(() => {
    if (viewport.maxY < viewport.minY) return [];
    return Array.from({ length: viewport.maxY - viewport.minY + 1 }, (_, offset) => viewport.minY + offset);
  }, [viewport]);

  const defaultSelectedKey = useMemo(() => {
    if (gameState.player) return keyOf(gameState.player.x, gameState.player.y);
    if (xValues.length && yValues.length) return keyOf(xValues[0], yValues[0]);
    return null;
  }, [gameState.player, xValues, yValues]);

  const activeSelectedKey = selectedKey ?? defaultSelectedKey;

  const hudItems = useMemo(
    () => [
      { label: "Floor", value: gameState.currentFloor ?? "-" },
      { label: "Turn", value: gameState.turnNumber ?? "-" },
      { label: "Energy", value: gameState.player?.energy ?? "-" },
      { label: "Treasure", value: gameState.player?.treasure ?? "-" },
      { label: "Marbles", value: gameState.player?.marbles ?? "-" },
      { label: "Enemies", value: gameState.enemies.length },
      { label: "Pickups", value: gameState.pickups.length },
      { label: "Interactive", value: gameState.interactive.length },
      { label: "Traps", value: gameState.traps.length + gameState.arrowTraps.length },
    ],
    [
      gameState.arrowTraps.length,
      gameState.currentFloor,
      gameState.enemies.length,
      gameState.interactive.length,
      gameState.pickups.length,
      gameState.player?.energy,
      gameState.player?.marbles,
      gameState.player?.treasure,
      gameState.traps.length,
      gameState.turnNumber,
    ],
  );

  const inspectorData = useMemo<CellInspectorData | null>(() => {
    if (!activeSelectedKey) return null;

    const [xRaw, yRaw] = activeSelectedKey.split(",");
    const x = Number.parseInt(xRaw, 10);
    const y = Number.parseInt(yRaw, 10);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

    const isPlayerCell = Boolean(gameState.player && gameState.player.x === x && gameState.player.y === y);
    const key = keyOf(x, y);

    const fog = fogLabel(matrixAt(gameState.fogMask, x, y));
    const tileValue = matrixAt(gameState.mapData, x, y);
    const tileDataValue = matrixAt(gameState.tileData, x, y);
    const entity = resolveEntityData({
      key,
      isPlayerCell,
      playerEnergy: gameState.player?.energy,
      enemiesByKey,
      interactiveByKey,
      pickupsByKey,
      trapsByKey,
      arrowTrapsByKey,
      portalsByKey,
    });

    return {
      x,
      y,
      fog,
      tileValue,
      tileDataValue,
      tileLabel: tileLabel(tileValue),
      entityKind: entity.entityKind,
      entityType: entity.entityType,
      entityId: entity.entityId,
      enemyHp: entity.enemyHp,
      badges: entity.badges,
      isPlayerCell,
      hint: hintsByKey.get(key) ?? null,
    };
  }, [
    activeSelectedKey,
    arrowTrapsByKey,
    enemiesByKey,
    gameState.fogMask,
    gameState.mapData,
    gameState.player,
    gameState.tileData,
    hintsByKey,
    interactiveByKey,
    pickupsByKey,
    portalsByKey,
    trapsByKey,
  ]);

  if (!xValues.length || !yValues.length) {
    return <p>No map data available.</p>;
  }

  return (
    <div className={`map-board-shell ${variant === "immersive" ? "map-board-shell-immersive" : ""}`}>
      <div className="map-board-toolbar">
        <div>
          <p className="map-board-toolbar-label">View</p>
          <p>
            <strong>{viewMode === "focus" ? "Focused" : "Full map"}</strong>
          </p>
        </div>
        <div className="map-board-toolbar-actions">
          <button
            type="button"
            onClick={() => setViewMode("focus")}
            disabled={viewMode === "focus"}
            title="Center view on the player"
          >
            Focus player
          </button>
          <button
            type="button"
            onClick={() => setViewMode("full")}
            disabled={viewMode === "full"}
            title="Show the entire map"
          >
            Full map
          </button>
        </div>
      </div>

      {!isImmersive ? (
        <>
          <div className="map-board-hud">
            {hudItems.map((item) => (
              <div key={item.label} className="map-board-hud-item">
                <span className="map-board-hud-label">{item.label}</span>
                <strong className="map-board-hud-value">{item.value}</strong>
              </div>
            ))}
          </div>
          <details className="map-board-help">
            <summary>Legend & controls</summary>
            <p className="map-board-legend">
              Legend: @ player, E enemy, G ghost, &gt; stairs, C chest, F fountain, B breakable, I interactive, $ pickup, ^ trap,
              A arrow trap, O portal, # wall, . room, : corridor.
            </p>
            <p className="map-board-legend">
              Adjacent action hints: green=move, orange=break, red=attack, gray=blocked.
            </p>
            <p className="map-board-legend">
              Mouse: left click = action/inspect (click self to skip), right click = inspect only.
            </p>
          </details>
        </>
      ) : null}

      <div className="map-board-layout">
        <div className="map-board-scroll">
          <div
            className="map-grid"
            style={{
              gridTemplateColumns: isImmersive
                ? `repeat(${xValues.length}, var(--map-cell-size, 40px))`
                : `var(--map-axis-size, 44px) repeat(${xValues.length}, var(--map-cell-size, 40px))`,
            }}
          >
            {!isImmersive ? <div className="map-grid-axis map-grid-corner">y\\x</div> : null}
            {!isImmersive
              ? xValues.map((x) => (
                  <div key={`x-${x}`} className="map-grid-axis">
                    {asTwoDigits(x)}
                  </div>
                ))
              : null}

            {yValues.map((y) => (
              <div key={`row-${y}`} className="map-grid-row">
                {!isImmersive ? <div className="map-grid-axis">{asTwoDigits(y)}</div> : null}
                {xValues.map((x) => {
                  const key = keyOf(x, y);
                  const isPlayerCell = Boolean(gameState.player && gameState.player.x === x && gameState.player.y === y);
                  const fog = fogLabel(matrixAt(gameState.fogMask, x, y));
                  const tileValue = matrixAt(gameState.mapData, x, y);
                  const tileDataValue = matrixAt(gameState.tileData, x, y);
                  const hint = hintsByKey.get(key) ?? null;
                  const entity = resolveEntityData({
                    key,
                    isPlayerCell,
                    playerEnergy: gameState.player?.energy,
                    enemiesByKey,
                    interactiveByKey,
                    pickupsByKey,
                    trapsByKey,
                    arrowTrapsByKey,
                    portalsByKey,
                  });

                  const symbol = entity.symbol || (fog === "hidden" ? "" : tileSymbol(tileValue));
                  const isSelected = activeSelectedKey === key;
                  const tileDataBadge =
                    typeof tileDataValue === "number" && tileDataValue >= 0 ? `td:${tileDataValue}` : null;
                  const allBadges = tileDataBadge ? [...entity.badges, tileDataBadge] : entity.badges;
                  const primaryBadge = allBadges[0] ?? null;
                  const secondaryBadge = allBadges[1] ?? null;
                  const isHintActionable = Boolean(hint && hint.type !== "blocked");
                  const isHintClickable = Boolean(isHintActionable && onDirectionalAction && !isActionLocked);
                  const isSelfSkipClickable = Boolean(isPlayerCell && onPassAction && !isActionLocked);
                  const isCellActionable = isHintClickable || isSelfSkipClickable;
                  const enemyOnCell = enemiesByKey.get(key);
                  const isGhostCell = Boolean(enemyOnCell && isGhostEnemy(enemyOnCell));
                  const hpRatio = enemyOnCell ? clampRatio(enemyOnCell.hp, enemyOnCell.maxHp) : null;
                  const tokenSymbol = entityTokenSymbol(entity.entityKind, symbol);

                  const classes = [
                    "map-cell",
                    `map-cell-fog-${fog}`,
                    `map-cell-tile-${tileLabel(tileValue)}`,
                    entity.entityKind ? `map-cell-entity-${entity.entityKind}` : "",
                    isGhostCell ? "map-cell-enemy-ghost" : "",
                    hint ? `map-cell-hint-${hint.type}` : "",
                    isSelected ? "map-cell-selected" : "",
                    isCellActionable ? "map-cell-clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const titleParts = [
                    `(${x},${y})`,
                    `fog:${fog}`,
                    `tile:${tileLabel(tileValue)}(${tileValue ?? "-"})`,
                    entity.entityKind ? `entity:${entity.entityKind}` : "",
                    entity.entityType ? `type:${entity.entityType}` : "",
                    entity.entityId ? `id:${entity.entityId}` : "",
                    entity.enemyHp ? `hp:${entity.enemyHp}` : "",
                    allBadges.length ? `badges:${allBadges.join(",")}` : "",
                    hint ? hint.label : "",
                    isSelfSkipClickable
                      ? "left click: skip turn | right click: inspect"
                      : isHintClickable
                        ? "left click: trigger action | right click: inspect"
                        : "click: inspect",
                  ].filter(Boolean);

                  return (
                    <button
                      key={key}
                      type="button"
                      className={classes}
                      title={titleParts.join(" | ")}
                      onClick={() => {
                        setSelectedKey(key);
                        if (isSelfSkipClickable && onPassAction && !isActionLocked) {
                          void onPassAction();
                          return;
                        }

                        if (hint && hint.type !== "blocked" && onDirectionalAction && !isActionLocked) {
                          void onDirectionalAction(hint.direction);
                        }
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setSelectedKey(key);
                      }}
                      data-direction={hint ? directionArrow(hint.direction) : undefined}
                    >
                      <span className={`map-cell-surface ${tileAccentClass(tileValue)}`} />
                      {fog !== "hidden" ? <span className="map-cell-gridline" /> : null}
                      {hint ? <span className={`map-cell-hint-arrow map-cell-hint-arrow-${hint.type}`} /> : null}
                      {isImmersive ? (
                        <>
                          {entity.entityKind ? (
                            <span className={`map-cell-token map-cell-token-${entity.entityKind} ${isGhostCell ? "map-cell-token-ghost" : ""}`}>
                              <span className="map-cell-token-symbol">{tokenSymbol}</span>
                            </span>
                          ) : (
                            <span className="map-cell-ambient-dot" />
                          )}
                          {hpRatio !== null ? (
                            <span className="map-cell-healthbar">
                              <span className="map-cell-healthbar-fill" style={{ width: `${Math.max(12, Math.round(hpRatio * 100))}%` }} />
                            </span>
                          ) : null}
                          {primaryBadge ? <span className="map-cell-chip map-cell-chip-primary">{primaryBadge}</span> : null}
                          {secondaryBadge ? <span className="map-cell-chip map-cell-chip-secondary">{secondaryBadge}</span> : null}
                        </>
                      ) : (
                        <>
                          <span className="map-cell-main">{symbol}</span>
                          {primaryBadge ? <span className="map-cell-badge map-cell-badge-primary">{primaryBadge}</span> : null}
                          {secondaryBadge ? (
                            <span className="map-cell-badge map-cell-badge-secondary">{secondaryBadge}</span>
                          ) : null}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <aside className={`map-inspector ${isImmersive ? "map-inspector-immersive" : ""}`}>
          <h4>Tile inspector</h4>
          {inspectorData ? (
            <>
              <p>
                coord: <strong>({inspectorData.x},{inspectorData.y})</strong>
              </p>
              <p>fog: {inspectorData.fog}</p>
              <p>
                tile: {inspectorData.tileLabel} ({inspectorData.tileValue ?? "-"})
              </p>
              <p>tileData: {inspectorData.tileDataValue ?? "-"}</p>
              <p>entity: {inspectorData.entityKind ?? "none"}</p>
              <p>type: {inspectorData.entityType ?? "-"}</p>
              <p>id: {inspectorData.entityId ?? "-"}</p>
              <p>enemy hp: {inspectorData.enemyHp ?? "-"}</p>
              <p>badges: {inspectorData.badges.length ? inspectorData.badges.join(", ") : "-"}</p>
              <p>player tile: {inspectorData.isPlayerCell ? "yes" : "no"}</p>
              <p>adjacent action: {inspectorData.hint?.label ?? "-"}</p>
            </>
          ) : (
            <p>No tile selected.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
