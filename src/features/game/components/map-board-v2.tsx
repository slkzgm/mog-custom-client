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
import type { GameStateSnapshot, MapEntitySnapshot, MoveDirection } from "../game.types";

type FogState = "hidden" | "explored" | "visible";
type TileKind = "wall" | "room" | "corridor" | "unknown";
type HintKind = "move" | "attack" | "break" | "blocked";
type EntityKind = "player" | "enemy" | "interactive" | "pickup" | "trap" | "arrow-trap" | "portal" | "torch";

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
  const value = matrixAt(gameState.mapData, x, y);
  if (value === 2) return "wall";
  if (value === 1) return "room";
  if (value === 0) return "corridor";
  return "unknown";
}

function buildViewport(gameState: GameStateSnapshot, mode: "focus" | "full"): Viewport {
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;

  if (mapWidth === 0 || mapHeight === 0) {
    return { minX: 0, maxX: -1, minY: 0, maxY: -1 };
  }

  if (mode === "full" || !gameState.player) {
    return { minX: 0, maxX: mapWidth - 1, minY: 0, maxY: mapHeight - 1 };
  }

  const radius = 6;
  return {
    minX: Math.max(0, gameState.player.x - radius),
    maxX: Math.min(mapWidth - 1, gameState.player.x + radius),
    minY: Math.max(0, gameState.player.y - radius),
    maxY: Math.min(mapHeight - 1, gameState.player.y + radius),
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

function interactiveToken(entity: MapEntitySnapshot) {
  const type = entity.type.trim().toLowerCase();
  if (type === "stairs") return { token: ">", accent: "gold", label: "Stairs" };
  if (type === "fountain") return { token: "F", accent: "cyan", label: "Fountain" };
  if (type === "crate" || type === "pot") return { token: "B", accent: "brown", label: "Breakable" };
  if (type === "door") return { token: "D", accent: "slate", label: "Door" };
  return { token: "I", accent: "gold", label: entity.type };
}

function pickupToken(entity: MapEntitySnapshot) {
  const type = entity.type.trim().toLowerCase();
  if (type.includes("energy")) return { token: "+", accent: "lime", label: "Energy" };
  if (type.includes("treasure")) return { token: "$", accent: "gold", label: "Treasure" };
  if (type.includes("marble")) return { token: "M", accent: "violet", label: "Marble" };
  return { token: "+", accent: "lime", label: entity.type };
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
      accent: isGhostEnemy(enemy) ? "ghost" : "enemy",
      hpRatio: ratio,
    };
  }

  const interactive = gameState.interactive.find((item) => item.x === x && item.y === y);
  if (interactive) {
    const token = interactiveToken(interactive);
    return {
      kind: "interactive",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
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
    };
  }

  const torch = gameState.torches.find((item) => item.x === x && item.y === y);
  if (torch) {
    return {
      kind: "torch",
      label: torch.type,
      token: "*",
      accent: "torch",
      hpRatio: null,
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const viewport = useMemo(() => buildViewport(gameState, viewMode), [gameState, viewMode]);
  const hintsByKey = useMemo(() => buildHints(gameState), [gameState]);
  const enemyLookup = useMemo(() => toLookup(gameState.enemies), [gameState.enemies]);

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

  if (!xValues.length || !yValues.length) {
    return <p>No map data available.</p>;
  }

  return (
    <div className="map2-shell">
      <div className="map2-controls">
        <div className="map2-segmented">
          <button type="button" onClick={() => setViewMode("focus")} disabled={viewMode === "focus"}>
            Focus
          </button>
          <button type="button" onClick={() => setViewMode("full")} disabled={viewMode === "full"}>
            Full
          </button>
        </div>
      </div>

      <div className="map2-stage">
        <div className="map2-board">
          <div className="map2-grid" style={{ gridTemplateColumns: `repeat(${xValues.length}, var(--map2-cell-size, 56px))` }}>
            {yValues.flatMap((y) =>
              xValues.map((x) => {
                const key = keyOf(x, y);
                const fog = fogStateAt(gameState, x, y);
                const tile = tileKindAt(gameState, x, y);
                const entity = resolveEntity(gameState, x, y);
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
                      `map2-cell-${tile}`,
                      `map2-fog-${fog}`,
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
                    {entity ? (
                      <span className="map2-token">
                        <span className="map2-token-core">{entity.token}</span>
                      </span>
                    ) : null}
                    {entity && entity.hpRatio !== null ? (
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
          </div>
        </aside>
      </div>
    </div>
  );
}
