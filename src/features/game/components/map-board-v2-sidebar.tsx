import { isSkullEnemySprite } from "../map-enemy-visuals";
import { isAttackableEnemy, isGhostEnemy } from "../game-map";
import type { MapBoardV2Model } from "./use-map-board-v2-model";
import { intentArrow } from "./map-board-v2.utils";

interface MapBoardV2SidebarProps {
  model: MapBoardV2Model;
  portalActionTitle?: string;
}

export function MapBoardV2Sidebar({ model, portalActionTitle }: MapBoardV2SidebarProps) {
  const {
    viewMode,
    focusWindowSize,
    effectiveFocusOffset,
    activeSelectedKey,
    latestPortalPrompt,
    selectedPortal,
    selectedEnemy,
    selectedEnemyIntentText,
    selectedEnemyNextMoveDirection,
    selectedEnemyShroomCharge,
    playerPortal,
    isSelectedPortalInActivePrompt,
    isMapVisitedCellsEnabled,
    isMapFogMemoryEnabled,
    isEncounterCatalogEnabled,
    isMapSnapshotProbeEnabled,
    encounterCatalog,
    entityMemory,
    fogMemory,
    mapSnapshotProbe,
    visitedCells,
    gameState,
    portalControl,
  } = model;

  return (
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
          <p className="map2-card-note">
            Zoom widens the focus window. Pan buttons only offset the current turn view; after a move, focus snaps back on the
            player.
          </p>
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
        {selectedPortal ? (
          <>
            <div className="map2-kv">
              <span>Portal</span>
              <strong>{selectedPortal.id ?? selectedPortal.type}</strong>
            </div>
            <div className="map2-kv">
              <span>Linked</span>
              <strong>{selectedPortal.linkedPortalId ?? "-"}</strong>
            </div>
            <div className="map2-kv">
              <span>Teleport cost</span>
              <strong>{isSelectedPortalInActivePrompt ? latestPortalPrompt?.teleportCost ?? "-" : "-"}</strong>
            </div>
          </>
        ) : null}
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
            {selectedEnemyShroomCharge ? (
              <>
                <div className="map2-kv">
                  <span>Attack line</span>
                  <strong>{selectedEnemyShroomCharge.direction}</strong>
                </div>
                <div className="map2-kv map2-kv-stack">
                  <span>Threat tiles</span>
                  <strong>{selectedEnemyShroomCharge.targetTiles.map((tile) => `${tile.x},${tile.y}`).join(" | ")}</strong>
                </div>
              </>
            ) : null}
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
        {playerPortal ? (
          <div className="panel-actions">
            <button
              type="button"
              onClick={() => void portalControl.onPortalAction?.()}
              disabled={portalControl.isPortalActionDisabled}
              title={portalActionTitle ?? "Use portal"}
            >
              Use portal
            </button>
          </div>
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
            {encounterCatalog.devFilePath ? `Dev file: ${encounterCatalog.devFilePath}` : "Stored locally in the browser while you explore."}
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
                    player {entry.playerX ?? "-"}, {entry.playerY ?? "-"} | in bounds {entry.playerInBounds === null ? "-" : entry.playerInBounds ? "yes" : "no"} | visible {entry.visibleCount} | explored {entry.exploredCount} | hidden {entry.hiddenCount}
                  </p>
                  <p className="map2-entity-row-meta">
                    tracked {entry.trackedTilesAfterSnapshot} | stable {entry.stableMatchesThisSnapshot} | conflicts {entry.tileConflictsThisSnapshot} | dim changed {entry.dimensionChangedWithinFloor ? "yes" : "no"}
                  </p>
                </article>
              ))}
            </div>
          </details>
        </div>
      ) : null}
    </aside>
  );
}
