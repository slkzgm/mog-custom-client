import { MapBoardV2Grid } from "./map-board-v2-grid";
import { useMapBoardV2Model } from "./use-map-board-v2-model";
import type { GameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { getRunModeRewardValue } from "../game-modes";
import { getUpgradeUiDescription, getUpgradeUiLabel } from "../upgrade-ui-catalog";
import { parseCoordinateKey } from "./map-board-v2.utils";

interface GameplayProductMapProps {
  model: GameplayProductScreenModel;
}

function ProductSelectedCellCard({
  mapModel,
}: {
  mapModel: ReturnType<typeof useMapBoardV2Model>;
}) {
  const selectedCell = mapModel.cells.find((cell) => cell.key === mapModel.activeSelectedKey) ?? null;
  const selectedCoords = mapModel.activeSelectedKey ? parseCoordinateKey(mapModel.activeSelectedKey) : null;

  if (!selectedCell || !selectedCoords) return null;

  return (
    <aside className="product-map-overlay product-map-overlay-details">
      <span className="product-card-label">Selected Cell</span>
      <div className="product-map-details-grid">
        <div>
          <span>Coordinates</span>
          <strong>
            {selectedCoords.x}, {selectedCoords.y}
          </strong>
        </div>
        <div>
          <span>Tile</span>
          <strong>{selectedCell.tile}</strong>
        </div>
        <div>
          <span>Fog</span>
          <strong>{selectedCell.fog}</strong>
        </div>
        <div>
          <span>Entity</span>
          <strong>{selectedCell.entity?.label ?? "-"}</strong>
        </div>
      </div>

      {selectedCell.entity ? (
        <div className="product-map-details-section">
          <p className="product-map-details-title">{selectedCell.entity.kind}</p>
          {selectedCell.entity.badges.length > 0 ? (
            <div className="product-map-details-badges">
              {selectedCell.entity.badges.map((badge) => (
                <span key={`${badge.position}:${badge.text}`} className={`product-map-details-badge tone-${badge.tone}`}>
                  {badge.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mapModel.selectedEnemy ? (
        <div className="product-map-details-section">
          <p className="product-map-details-title">Enemy Intel</p>
          <div className="product-map-details-grid">
            <div>
              <span>Type</span>
              <strong>{mapModel.selectedEnemy.type}</strong>
            </div>
            <div>
              <span>HP</span>
              <strong>
                {mapModel.selectedEnemy.hp ?? "-"}
                {mapModel.selectedEnemy.maxHp !== null ? ` / ${mapModel.selectedEnemy.maxHp}` : ""}
              </strong>
            </div>
            <div>
              <span>Damage</span>
              <strong>{mapModel.selectedEnemy.damage ?? "-"}</strong>
            </div>
            <div>
              <span>Intent</span>
              <strong>{mapModel.selectedEnemyIntentText ?? "-"}</strong>
            </div>
          </div>
        </div>
      ) : null}

      {mapModel.selectedPortal ? (
        <div className="product-map-details-section">
          <p className="product-map-details-title">Portal Link</p>
          <div className="product-map-details-grid">
            <div>
              <span>Portal</span>
              <strong>{mapModel.selectedPortal.id ?? mapModel.selectedPortal.type}</strong>
            </div>
            <div>
              <span>Linked</span>
              <strong>{mapModel.selectedPortal.linkedPortalId ?? "-"}</strong>
            </div>
            <div>
              <span>Cost</span>
              <strong>{mapModel.isSelectedPortalInActivePrompt ? mapModel.latestPortalPrompt?.teleportCost ?? "-" : "-"}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function ProductMapToolbar({
  model,
  mapModel,
}: {
  model: GameplayProductScreenModel;
  mapModel: ReturnType<typeof useMapBoardV2Model>;
}) {
  return (
    <div className="product-map-toolbar">
      <div className="product-map-toolbar-group">
        <button
          type="button"
          className={`product-map-toolbar-button ${mapModel.viewMode === "focus" ? "is-active" : ""}`}
          onClick={() => mapModel.setFocusMode("focus")}
        >
          Focus
        </button>
        <button
          type="button"
          className={`product-map-toolbar-button ${mapModel.viewMode === "full" ? "is-active" : ""}`}
          onClick={() => mapModel.setFocusMode("full")}
        >
          Full
        </button>
      </div>

      {mapModel.viewMode === "focus" ? (
        <>
          <div className="product-map-toolbar-group">
            <button type="button" className="product-map-toolbar-button" onClick={mapModel.zoomIn}>
              -
            </button>
            <span className="product-map-toolbar-readout">{mapModel.focusWindowSize}x{mapModel.focusWindowSize}</span>
            <button type="button" className="product-map-toolbar-button" onClick={mapModel.zoomOut}>
              +
            </button>
          </div>

          <div className="product-map-toolbar-group">
            <button type="button" className="product-map-toolbar-button" onClick={() => mapModel.panFocus(-2, 0)}>
              Left
            </button>
            <button type="button" className="product-map-toolbar-button" onClick={() => mapModel.panFocus(0, -2)}>
              Up
            </button>
            <button type="button" className="product-map-toolbar-button" onClick={() => mapModel.panFocus(0, 2)}>
              Down
            </button>
            <button type="button" className="product-map-toolbar-button" onClick={() => mapModel.panFocus(2, 0)}>
              Right
            </button>
            <button type="button" className="product-map-toolbar-button" onClick={mapModel.resetFocusOffset}>
              Center
            </button>
          </div>
        </>
      ) : null}

      <div className="product-map-toolbar-group product-map-toolbar-group-spacer" />

      <div className="product-map-toolbar-group">
        <span className="product-map-toolbar-meta">Movement</span>
        <button
          type="button"
          className={`product-map-toolbar-button ${model.gameplayFeelMode === "standard" ? "is-active" : ""}`}
          onClick={() => model.setGameplayFeelMode("standard")}
          title="Default movement rendering with no predictive preview."
        >
          Accurate
        </button>
        <button
          type="button"
          className={`product-map-toolbar-button ${model.gameplayFeelMode === "preview" ? "is-active" : ""}`}
          onClick={() => model.setGameplayFeelMode("preview")}
          title="Experimental instant movement preview. Server state remains authoritative."
        >
          Instant
        </button>
      </div>

      <div className="product-map-toolbar-group">
        <span className="product-map-toolbar-meta">
          Floor {model.gameplay.runState?.currentFloor ?? "-"} / Turn {model.gameplay.runState?.turnNumber ?? "-"}
        </span>
      </div>
    </div>
  );
}

function ProductMapHud({ model }: GameplayProductMapProps) {
  const player = model.gameplay.runState?.player;
  const upgrades = player?.upgrades ?? [];
  const rewardLabel = model.gameplay.runSession.mode.rewardLabel;
  const rewardValue = getRunModeRewardValue(model.gameplay.runSession.runType, player);

  return (
    <>
      <div className="product-map-overlay product-map-overlay-upgrades">
        <span className="product-card-label">Active Modifications</span>
        <ul className="product-upgrade-list">
          {upgrades.length > 0 ? (
            upgrades.map((upgrade) => (
              <li key={upgrade} title={getUpgradeUiDescription(upgrade, { runType: model.gameplay.runSession.runType }) ?? undefined}>
                {getUpgradeUiLabel(upgrade)}
              </li>
            ))
          ) : (
            <li className="is-empty">No upgrades yet</li>
          )}
        </ul>
      </div>

      <div className="product-map-overlay product-map-overlay-stats">
        <div className="product-map-stat">
          <span>Floor</span>
          <strong>{model.gameplay.runState?.currentFloor ?? "-"}</strong>
        </div>
        <div className="product-map-stat">
          <span>Turn</span>
          <strong>{model.gameplay.runState?.turnNumber ?? "-"}</strong>
        </div>
        <div className="product-map-stat">
          <span>Marbles</span>
          <strong>{player?.marbles ?? "-"}</strong>
        </div>
        <div className="product-map-stat">
          <span>{rewardLabel}</span>
          <strong>{rewardValue ?? "-"}</strong>
        </div>
      </div>
    </>
  );
}

function ProductMobileControls({ model }: GameplayProductMapProps) {
  const controls = model.gameplay.controls;
  const portalValidation = controls.validateUsePortal();
  const centerLabel = !portalValidation ? "Portal" : "Pass";
  const isCenterDisabled = !portalValidation
    ? model.gameplay.isActionLocked || controls.runTeleportMutation.isPending
    : Boolean(controls.validatePass()) || model.gameplay.isActionLocked;

  return (
    <div className="product-mobile-controls">
      <div className="product-mobile-controls-topbar">
        <button type="button" className="product-mobile-menu-button" onClick={model.openMenu}>
          Menu
        </button>
      </div>
      <button type="button" onClick={() => void controls.handleMove("up")} disabled={Boolean(controls.validateMove("up")) || model.gameplay.isActionLocked}>
        Up
      </button>
      <div className="product-mobile-controls-row">
        <button
          type="button"
          onClick={() => void controls.handleMove("left")}
          disabled={Boolean(controls.validateMove("left")) || model.gameplay.isActionLocked}
        >
          Left
        </button>
        <button
          type="button"
          className="is-primary"
          onClick={() => void (!portalValidation ? controls.handleUsePortal() : controls.handlePass())}
          disabled={isCenterDisabled}
        >
          {centerLabel}
        </button>
        <button
          type="button"
          onClick={() => void controls.handleMove("right")}
          disabled={Boolean(controls.validateMove("right")) || model.gameplay.isActionLocked}
        >
          Right
        </button>
      </div>
      <button
        type="button"
        onClick={() => void controls.handleMove("down")}
        disabled={Boolean(controls.validateMove("down")) || model.gameplay.isActionLocked}
      >
        Down
      </button>
    </div>
  );
}

function ProductUpgradeSelection({ model }: GameplayProductMapProps) {
  if (!model.gameplay.upgrades.hasPendingUpgradeSelection) return null;

  return (
    <section className="product-upgrade-sheet">
      <div className="product-upgrade-sheet-card">
        <span className="product-card-label">Select Modification</span>
        <div className="product-upgrade-choice-grid">
          {model.gameplay.upgrades.pendingUpgradeOptions.map((upgradeId) => (
            <button
              key={upgradeId}
              type="button"
              className="product-upgrade-choice"
              onClick={() => void model.gameplay.upgrades.handleSelectUpgrade(upgradeId)}
              disabled={model.gameplay.upgrades.runRerollMutation.isPending || model.gameplay.upgrades.selectUpgradeMutation.isPending}
              title={getUpgradeUiDescription(upgradeId, { runType: model.gameplay.runSession.runType }) ?? undefined}
            >
              <span className="product-upgrade-choice-title">{getUpgradeUiLabel(upgradeId)}</span>
              {getUpgradeUiDescription(upgradeId, { runType: model.gameplay.runSession.runType }) ? (
                <small className="product-upgrade-choice-copy">
                  {getUpgradeUiDescription(upgradeId, { runType: model.gameplay.runSession.runType })}
                </small>
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="product-button product-button-secondary"
          onClick={() => void model.gameplay.upgrades.handleRerollUpgrades()}
          disabled={model.gameplay.upgrades.isRerollDisabled}
        >
          {model.gameplay.upgrades.runRerollMutation.isPending ? "Rerolling..." : "Reroll"}
        </button>
      </div>
    </section>
  );
}

export function GameplayProductMap({ model }: GameplayProductMapProps) {
  const runState = model.gameplay.runState!;

  const mapModel = useMapBoardV2Model({
    gameState: runState,
    optimisticPlayerPosition: model.gameplay.optimisticPlayerPosition,
    moveEvents: model.gameplay.lastMoveEvents,
    portalPrompt: model.gameplay.portalPrompt,
    onDirectionalAction: model.gameplay.controls.handleMove,
    onPassAction: model.gameplay.controls.handlePass,
    onPortalAction: model.gameplay.controls.handleUsePortal,
    isPortalActionDisabled:
      Boolean(model.gameplay.controls.validateUsePortal()) ||
      model.gameplay.controls.runTeleportMutation.isPending ||
      model.gameplay.isActionLocked,
    isActionLocked: model.gameplay.isActionLocked,
  });

  return (
    <section className="product-map-shell">
      <div className="product-map-stage">
        <ProductMapToolbar model={model} mapModel={mapModel} />
        <div className="product-map-grid-wrap">
          <MapBoardV2Grid
            cells={mapModel.cells}
            columnCount={mapModel.columnCount}
            onActivateCell={mapModel.handleActivateCell}
            onSelectCell={mapModel.handleSelectCell}
          />
          <ProductMapHud model={model} />
          <ProductSelectedCellCard mapModel={mapModel} />
        </div>
        <ProductMobileControls model={model} />
      </div>

      <ProductUpgradeSelection model={model} />
    </section>
  );
}
