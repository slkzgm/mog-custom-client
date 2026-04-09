import { useGameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { shortenAddress } from "../../auth/use-auth-controller";
import { GameplayProductLobby } from "./gameplay-product-lobby";
import { GameplayProductMap } from "./gameplay-product-map";
import { getRunModeDefinition } from "../game-modes";
import { formatCurrentMaxValue } from "../runtime/game-runtime.utils";

function ProductTopBar({ model }: { model: ReturnType<typeof useGameplayProductScreenModel> }) {
  const player = model.gameplay.runState?.player;
  const profileName = model.auth.profileQuery.data?.profileName ?? "Operator";
  const profilePictureUrl = model.auth.profileQuery.data?.profilePictureUrl ?? null;
  const walletLabel = model.auth.isWalletConnected ? shortenAddress(model.auth.walletAddress) : "Connect";
  const amberValue = player?.amber ?? model.amberBalanceQuery.data?.balance ?? "-";
  const weeklyMarbles = model.claimsQuery.data?.currentWeek?.userMarbles ?? "-";
  const weeklyTreasure = model.claimsQuery.data?.currentWeek?.userTreasure ?? "-";

  return (
    <header className="product-topbar">
      <div className="product-topbar-left">
        <span className="product-topbar-brand-mark">MOG_PLAY</span>
        <div className="product-topbar-stats">
          <div className="product-topbar-stat product-topbar-stat-gold">
            <span>Arcade Keys</span>
            <strong>{model.normalGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
          </div>
          <div className="product-topbar-stat product-topbar-stat-marble">
            <span>Marbles</span>
            <strong>{weeklyMarbles}</strong>
          </div>
          <div className="product-topbar-stat product-topbar-stat-ember">
            <span>World Keys</span>
            <strong>{model.worldGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
          </div>
          <div className="product-topbar-stat">
            <span>Treasures</span>
            <strong>{weeklyTreasure}</strong>
          </div>
          <div className="product-topbar-stat product-topbar-stat-amber">
            <span>Amber</span>
            <strong>{amberValue}</strong>
          </div>
        </div>
      </div>

      <div className="product-topbar-right">
        {model.shouldShowRun ? (
          <button type="button" className="product-topbar-link" onClick={model.openMenu}>
            Menu
          </button>
        ) : null}
          {model.auth.isWalletConnected ? (
            <div className="product-topbar-profile-card">
              <div className="product-topbar-profile-copy">
                <span>{profileName}</span>
                <strong>{walletLabel}</strong>
              </div>
              <div className="product-avatar-frame product-avatar-frame-small">
                {profilePictureUrl ? <img src={profilePictureUrl} alt={profileName} className="product-avatar-image" /> : <span>{profileName.slice(0, 1)}</span>}
              </div>
              <button
                type="button"
                className="product-topbar-icon-button"
                onClick={model.auth.disconnectWallet}
                title="Disconnect wallet"
                aria-label="Disconnect wallet"
              >
                <span className="product-topbar-power-icon" aria-hidden="true" />
              </button>
            </div>
          ) : (
          <div className="product-topbar-guest">
            <span>Wallet</span>
            <strong>Connect</strong>
          </div>
        )}
      </div>
    </header>
  );
}

export function GameplayProductScreen() {
  const model = useGameplayProductScreenModel();

  return (
    <main className={`gameplay-map-page product-shell ${model.shouldShowRun ? "product-shell-map" : "product-shell-lobby"}`}>
      <ProductTopBar model={model} />
      <div className="product-shell-body">
        {model.shouldShowRun ? <GameplayProductMap model={model} /> : <GameplayProductLobby model={model} />}
      </div>
      {model.completedRunRecap ? <CompletedRunRecapModal model={model} /> : null}
    </main>
  );
}

function CompletedRunRecapModal({ model }: { model: ReturnType<typeof useGameplayProductScreenModel> }) {
  const recap = model.completedRunRecap;
  if (!recap) return null;

  const mode = getRunModeDefinition(recap.runType ?? "NORMAL");

  return (
    <div className="product-run-recap-backdrop" role="presentation" onClick={model.dismissCompletedRunRecap}>
      <section
        className="product-run-recap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-run-recap-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="product-card-label">Run Recap</span>
        <h2 id="product-run-recap-title">{recap.outcome === "victory" ? "Run Cleared" : "Run Ended"}</h2>
        <p>
          {mode.label} finished on floor {recap.currentFloor ?? "-"} at turn {recap.turnNumber ?? "-"}.
        </p>
        <div className="product-history-entry-grid">
          <div>
            <span>Energy</span>
            <strong>{formatCurrentMaxValue(recap.energy, recap.maxEnergy)}</strong>
          </div>
          <div>
            <span>Treasure</span>
            <strong>{recap.treasure ?? "-"}</strong>
          </div>
          <div>
            <span>Marbles</span>
            <strong>{recap.marbles ?? "-"}</strong>
          </div>
          <div>
            <span>Upgrades</span>
            <strong>{recap.upgradesCount}</strong>
          </div>
        </div>
        <div className="product-card-actions">
          <button type="button" className="product-button product-button-primary" onClick={model.dismissCompletedRunRecap}>
            Back To Menu
          </button>
        </div>
      </section>
    </div>
  );
}
