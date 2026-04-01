import { MapBoardV2Grid } from "./map-board-v2-grid";
import { useMapBoardV2Model } from "./use-map-board-v2-model";
import type { GameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { getRunModeRewardValue } from "../game-modes";

interface GameplayProductMapProps {
  model: GameplayProductScreenModel;
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
            upgrades.map((upgrade) => <li key={upgrade}>{upgrade}</li>)
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
            >
              {upgradeId}
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
        <div className="product-map-grid-wrap">
          <MapBoardV2Grid
            cells={mapModel.cells}
            columnCount={mapModel.columnCount}
            onActivateCell={mapModel.handleActivateCell}
            onSelectCell={mapModel.handleSelectCell}
          />
          <ProductMapHud model={model} />
        </div>
        <ProductMobileControls model={model} />
      </div>

      <ProductUpgradeSelection model={model} />
    </section>
  );
}
