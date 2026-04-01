import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";
import { useGameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { shortenAddress } from "../../auth/use-auth-controller";
import { getRunModeRewardValue } from "../game-modes";
import { GameplayProductLobby } from "./gameplay-product-lobby";
import { GameplayProductMap } from "./gameplay-product-map";

function ProductTopBar({ model }: { model: ReturnType<typeof useGameplayProductScreenModel> }) {
  const player = model.gameplay.runState?.player;
  const profileName = model.auth.profileQuery.data?.profileName ?? "Operator";
  const profilePictureUrl = model.auth.profileQuery.data?.profilePictureUrl ?? null;
  const walletLabel = model.auth.isWalletConnected ? shortenAddress(model.auth.walletAddress) : "Connect";
  const rewardLabel = model.gameplay.runSession.mode.rewardLabel;
  const rewardValue = getRunModeRewardValue(model.gameplay.runSession.runType, player);

  return (
    <header className="product-topbar">
      <div className="product-brand">
        <span className="product-brand-mark">OSS_TERMINAL</span>
      </div>

      <div className="product-topbar-stats">
        <div className="product-topbar-stat">
          <span>Arcade Keys</span>
          <strong>{model.normalGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
        </div>
        <div className="product-topbar-stat">
          <span>World Keys</span>
          <strong>{model.worldGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
        </div>
        <div className="product-topbar-stat">
          <span>Amber</span>
          <strong>{model.amberBalanceQuery.data?.balance ?? "-"}</strong>
        </div>
        <div className="product-topbar-stat">
          <span>Marbles</span>
          <strong>{player?.marbles ?? "-"}</strong>
        </div>
        <div className="product-topbar-stat">
          <span>{rewardLabel}</span>
          <strong>{rewardValue ?? "-"}</strong>
        </div>
        <div className="product-topbar-stat">
          <span>Wallet</span>
          <strong>{walletLabel}</strong>
        </div>
      </div>

      <div className="product-topbar-actions">
        {model.auth.isWalletConnected ? (
          <div className="product-topbar-profile">
            <div className="product-avatar-frame product-avatar-frame-small">
              {profilePictureUrl ? <img src={profilePictureUrl} alt={profileName} className="product-avatar-image" /> : <span>{profileName.slice(0, 1)}</span>}
            </div>
            <div className="product-topbar-profile-copy">
              <span>{profileName}</span>
              <strong>{walletLabel}</strong>
            </div>
          </div>
        ) : null}
        {model.auth.isWalletConnected ? (
          <button type="button" className="product-button product-button-ghost" onClick={model.auth.disconnectWallet}>
            Disconnect
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function GameplayProductScreen() {
  const model = useGameplayProductScreenModel();

  useGameplayHotkeys({
    disabled: model.gameplay.hotkeysDisabled || !model.hasRunState,
    onMove: model.gameplay.controls.handleMove,
    onPass: model.gameplay.controls.handlePass,
    pendingUpgradeOptions: model.gameplay.upgrades.pendingUpgradeOptions,
    onRerollUpgrades: model.gameplay.upgrades.handleRerollUpgrades,
    onSelectUpgrade: model.gameplay.upgrades.handleSelectUpgrade,
  });

  return (
    <main className={`gameplay-map-page product-shell ${model.hasRunState ? "product-shell-map" : "product-shell-lobby"}`}>
      <ProductTopBar model={model} />
      <div className="product-shell-body">
        {model.hasRunState ? <GameplayProductMap model={model} /> : <GameplayProductLobby model={model} />}
      </div>
    </main>
  );
}
