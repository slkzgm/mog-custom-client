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
import { useEncounterCatalog } from "../runtime/use-encounter-catalog";
import type { RememberedEntity } from "../runtime/map-entity-memory";
import { useMapEntityMemory } from "../runtime/use-map-entity-memory";
import { useMapFogMemory } from "../runtime/use-map-fog-memory";
import { useMapSnapshotProbe } from "../runtime/use-map-snapshot-probe";
import { appConfig } from "../../../app/config";

type FogState = "hidden" | "explored" | "visible" | "remembered";
type TileKind = "wall" | "room" | "corridor" | "unknown" | "void";
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

function rememberedEntityToCellEntity(entity: RememberedEntity): CellEntity {
  if (entity.kind === "interactive") {
    const token = interactiveToken({
      x: entity.x,
      y: entity.y,
      type: entity.type,
      id: entity.id,
      value: entity.value,
      damage: entity.damage,
      tileIndex: null,
    });
    return {
      kind: "interactive",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
    };
  }

  if (entity.kind === "pickup") {
    const token = pickupToken({
      x: entity.x,
      y: entity.y,
      type: entity.type,
      id: entity.id,
      value: entity.value,
      damage: entity.damage,
      tileIndex: null,
    });
    return {
      kind: "pickup",
      label: token.label,
      token: token.token,
      accent: token.accent,
      hpRatio: null,
    };
  }

  if (entity.kind === "trap") {
    return {
      kind: "trap",
      label: entity.type,
      token: "^",
      accent: "trap",
      hpRatio: null,
    };
  }

  if (entity.kind === "arrow-trap") {
    return {
      kind: "arrow-trap",
      label: entity.type,
      token: "^",
      accent: "trap",
      hpRatio: null,
    };
  }

  if (entity.kind === "portal") {
    return {
      kind: "portal",
      label: entity.type,
      token: "O",
      accent: "portal",
      hpRatio: null,
    };
  }

  return {
    kind: "torch",
    label: entity.type,
    token: "*",
    accent: "torch",
    hpRatio: null,
  };
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
  const encounterCatalog = useEncounterCatalog(gameState, isEncounterCatalogEnabled);
  const entityMemory = useMapEntityMemory(gameState, isMapFogMemoryEnabled);
  const fogMemory = useMapFogMemory(gameState, isMapFogMemoryEnabled);
  const mapSnapshotProbe = useMapSnapshotProbe(gameState, isMapSnapshotProbeEnabled);

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
                const entity =
                  currentEntity ?? (rememberedEntity && currentFog !== "visible" ? rememberedEntityToCellEntity(rememberedEntity) : null);
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
                    {entity && fog !== "hidden" ? (
                      <span className="map2-token">
                        <span className="map2-token-core">{entity.token}</span>
                      </span>
                    ) : null}
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
