import { MapBoardV2 } from "./map-board-v2";
import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";
import { useGameplayScreenModel } from "../runtime/use-gameplay-screen-model";

export function GameplayPrototypeScreen() {
  const model = useGameplayScreenModel();

  useGameplayHotkeys({
    disabled: model.hotkeysDisabled,
    onMove: model.handleMove,
    onPass: model.handlePass,
  });

  if (!model.runState) {
    return (
      <main className="gameplay-map-page gameplay-map-page-empty">
        <section className="gameplay-map-empty-card">
          <p className="panel-eyebrow">Gameplay</p>
          <h1>No active run loaded</h1>
          <p className="text-muted">Use `#workbench` to start or resume a run. This screen is intentionally map-only.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="gameplay-map-page">
      <MapBoardV2
        gameState={model.runState}
        onDirectionalAction={model.handleMove}
        onPassAction={model.handlePass}
        isActionLocked={model.isActionLocked}
      />
      {model.upgrades.hasPendingUpgradeSelection ? (
        <section className="gameplay-upgrade-overlay">
          <div className="gameplay-upgrade-card">
            <p className="panel-eyebrow">Upgrade</p>
            <h2>Choose a boost</h2>
            <div className="panel-actions">
              <button
                type="button"
                onClick={() => void model.upgrades.handleRerollUpgrades()}
                disabled={model.upgrades.isRerollDisabled}
                title={model.upgrades.rerollValidationError ?? "Reroll options"}
              >
                {model.upgrades.runRerollMutation.isPending ? "Rerolling..." : "Reroll"}
              </button>
              {model.upgrades.pendingUpgradeOptions.map((upgradeId) => (
                <button
                  key={upgradeId}
                  type="button"
                  onClick={() => void model.upgrades.handleSelectUpgrade(upgradeId)}
                  disabled={model.upgrades.runRerollMutation.isPending || model.upgrades.selectUpgradeMutation.isPending}
                >
                  {upgradeId}
                </button>
              ))}
            </div>
            {model.upgrades.rerollValidationError ? (
              <p className="text-muted">{model.upgrades.rerollValidationError}</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
