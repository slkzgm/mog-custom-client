import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";
import { useGameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { shortenAddress } from "../../auth/use-auth-controller";
import { GameplayProductLobby } from "./gameplay-product-lobby";
import { GameplayProductMap } from "./gameplay-product-map";

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
        <span className="product-topbar-brand-mark">OSS_TERMINAL</span>
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

  useGameplayHotkeys({
    disabled: model.gameplay.hotkeysDisabled || !model.shouldShowRun,
    isActionPending: model.gameplay.controls.isAnyActionPending,
    onMove: model.gameplay.controls.handleMove,
    onPass: model.gameplay.controls.handlePass,
    pendingUpgradeOptions: model.gameplay.upgrades.pendingUpgradeOptions,
    onRerollUpgrades: model.gameplay.upgrades.handleRerollUpgrades,
    onSelectUpgrade: model.gameplay.upgrades.handleSelectUpgrade,
  });

  return (
    <main className={`gameplay-map-page product-shell ${model.shouldShowRun ? "product-shell-map" : "product-shell-lobby"}`}>
      <ProductTopBar model={model} />
      <div className="product-shell-body">
        {model.shouldShowRun ? <GameplayProductMap model={model} /> : <GameplayProductLobby model={model} />}
      </div>
    </main>
  );
}
