import { shortenAddress } from "../../auth/use-auth-controller";
import type { GameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";

interface GameplayProductLobbyProps {
  model: GameplayProductScreenModel;
}

function ProductStatusBar({ model }: GameplayProductLobbyProps) {
  const walletLabel = model.auth.isWalletConnected ? shortenAddress(model.auth.walletAddress) : "Disconnected";

  return (
    <div className="product-status-strip">
      <div className="product-status-item">
        <span>Operator</span>
        <strong>{walletLabel}</strong>
      </div>
      <div className="product-status-item">
        <span>Arcade Keys</span>
        <strong>{model.normalGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
      </div>
      <div className="product-status-item">
        <span>World Keys</span>
        <strong>{model.worldGameplay.runSession.balanceQuery.data?.balance ?? "-"}</strong>
      </div>
      <div className="product-status-item">
        <span>Amber</span>
        <strong>{model.amberBalanceQuery.data?.balance ?? "-"}</strong>
      </div>
      <div className="product-status-item">
        <span>Session</span>
        <strong>{model.auth.isAuthenticated ? "Authenticated" : "Pending"}</strong>
      </div>
    </div>
  );
}

function ProductIdentityCard({ model }: GameplayProductLobbyProps) {
  const profileName = model.auth.profileQuery.data?.profileName ?? "Unnamed operator";
  const profilePictureUrl = model.auth.profileQuery.data?.profilePictureUrl ?? null;

  return (
    <section className="product-card product-identity-card">
      <div className="product-avatar-frame">
        {profilePictureUrl ? <img src={profilePictureUrl} alt={profileName} className="product-avatar-image" /> : <span>{profileName.slice(0, 1)}</span>}
      </div>
      <div className="product-identity-copy">
        <span className="product-card-label">Operator Profile</span>
        <h2>{profileName}</h2>
        <p>{model.auth.walletAddress ? shortenAddress(model.auth.walletAddress) : "No wallet connected yet."}</p>
      </div>
    </section>
  );
}

function ProductHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="product-hero">
      <span className="product-hero-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

function ConnectPanel({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-card product-card-focus">
      <ProductHero
        eyebrow="Wallet Access"
        title="Connect Your Wallet"
        description="Authentication starts with a wallet session. Connect an Abstract wallet or injected wallet to access runs, keys, and map progression."
      />

      <div className="product-card-actions">
        <button type="button" className="product-button product-button-primary" onClick={model.auth.connectAbstractWallet}>
          Connect AGW
        </button>
        {model.auth.injectedConnectors.map((connector) => (
          <button
            key={connector.id}
            type="button"
            className="product-button product-button-secondary"
            onClick={() => model.auth.connectInjectedWallet(connector.id)}
          >
            Connect {connector.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function ChainPanel({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-card product-card-focus">
      <ProductHero
        eyebrow="Network Check"
        title="Switch To The Supported Chain"
        description={`The product currently expects chain ${model.auth.expectedChainId}. Switch network before signing in to keep the session and transaction flow coherent.`}
      />
      <div className="product-inline-metadata">
        <div>
          <span>Connected wallet</span>
          <strong>{shortenAddress(model.auth.walletAddress)}</strong>
        </div>
        <div>
          <span>Current chain</span>
          <strong>{model.auth.walletChainId ?? "-"}</strong>
        </div>
      </div>
      <div className="product-card-actions">
        <button type="button" className="product-button product-button-primary" onClick={model.auth.switchToExpectedChain}>
          Switch Chain
        </button>
        <button type="button" className="product-button product-button-ghost" onClick={model.auth.disconnectWallet}>
          Disconnect
        </button>
      </div>
    </section>
  );
}

function SignInPanel({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-card product-card-focus">
      <ProductHero
        eyebrow="Session Handshake"
        title="Sign In To Recover Progress"
        description="Once the wallet is connected on the right chain, sign the SIWE message to access arcade and world runs, resource balances, and saved progression."
      />
      <div className="product-inline-metadata">
        <div>
          <span>Wallet</span>
          <strong>{shortenAddress(model.auth.walletAddress)}</strong>
        </div>
        <div>
          <span>Profile</span>
          <strong>{model.auth.profileQuery.data?.profileName ?? "Unnamed operator"}</strong>
        </div>
      </div>
      <div className="product-card-actions">
        <button type="button" className="product-button product-button-primary" onClick={() => void model.auth.signIn()}>
          {model.auth.signInMutation.isPending || model.auth.signMessageMutation.isPending ? "Signing In..." : "Sign In"}
        </button>
        <button type="button" className="product-button product-button-ghost" onClick={model.auth.disconnectWallet}>
          Disconnect
        </button>
      </div>
      {model.auth.authValidationError ? <p className="product-card-note">{model.auth.authValidationError}</p> : null}
    </section>
  );
}

function RunModeCard({
  mode,
}: {
  mode: GameplayProductScreenModel["modeCards"][number];
}) {
  const isLoading = mode.session.runSession.createRunMutation.isPending || mode.session.runSession.runStateQuery.isFetching;
  const actionLabel = mode.hasActiveRun ? "Resume Run" : "Start Run";
  const onPrimaryAction = mode.hasActiveRun ? mode.handleResumeRun : mode.handleStartRun;

  return (
    <section className={`product-mode-card product-mode-card-${mode.definition.accent}`}>
      <div className="product-mode-card-header">
        <span className="product-card-label">{mode.definition.runType}</span>
        <strong>{mode.definition.rewardLabel}</strong>
      </div>
      <h2>{mode.definition.label}</h2>
      <p>{mode.definition.description}</p>

      <div className="product-metric-grid">
        <div>
          <span>Available keys</span>
          <strong>{mode.balance ?? "-"}</strong>
        </div>
        <div>
          <span>Active run</span>
          <strong>{mode.hasActiveRun ? "Detected" : "None"}</strong>
        </div>
      </div>

      {!mode.hasActiveRun ? (
        <label className="product-field">
          <span>Quantity of keys</span>
          <input
            value={mode.session.runSession.keysAmountInput}
            onChange={(event) => mode.session.runSession.setKeysAmountInput(event.target.value)}
            inputMode="numeric"
          />
        </label>
      ) : null}

      <button
        type="button"
        className={`product-button ${mode.definition.accent === "gold" ? "product-button-primary" : "product-button-secondary"}`}
        onClick={() => void onPrimaryAction()}
        disabled={mode.hasActiveRun ? mode.session.runSession.runStateQuery.isFetching : !mode.session.runSession.canStartRun}
      >
        {isLoading ? "Loading..." : actionLabel}
      </button>

      {!mode.hasActiveRun && mode.session.runSession.startRunValidationError ? (
        <p className="product-card-note">{mode.session.runSession.startRunValidationError}</p>
      ) : null}

      {mode.hasActiveRun ? (
        <div className="product-inline-metadata">
          <div>
            <span>Run ID</span>
            <strong>{mode.session.runSession.activeRunId ?? "-"}</strong>
          </div>
          <div>
            <span>Can resume</span>
            <strong>{mode.session.runSession.runStateQuery.data?.canResume ? "Yes" : "Unknown"}</strong>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BuyKeysPanel({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-card product-buy-card">
      <div className="product-mode-card-header">
        <span className="product-card-label">Support</span>
        <strong>Arcade Keys</strong>
      </div>
      <h2>Buy More Keys</h2>
      <p>Classic key purchase flow for Normal Mode. World keys currently only expose balance in the live API we integrated.</p>

      <div className="product-metric-grid">
        <div>
          <span>Buy quantity</span>
          <strong>{model.buyKeys.parsedBuyKeysQuantity ?? "-"}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{model.buyKeys.buyKeysValueEth} ETH</strong>
        </div>
      </div>

      <label className="product-field">
        <span>Quantity of keys</span>
        <input
          value={model.buyKeys.buyKeysQuantityInput}
          onChange={(event) => model.buyKeys.setBuyKeysQuantityInput(event.target.value)}
          inputMode="numeric"
        />
      </label>

      <button
        type="button"
        className="product-button product-button-primary"
        onClick={() => void model.buyKeys.handleBuyKeys()}
        disabled={!model.buyKeys.canBuyKeys}
      >
        {model.buyKeys.buyKeysMutation.isPending
          ? "Confirm In Wallet..."
          : model.buyKeys.isBuyKeysReceiptFetching
            ? "Confirming..."
            : "Buy Keys"}
      </button>

      {model.buyKeys.buyKeysValidationError ? <p className="product-card-note">{model.buyKeys.buyKeysValidationError}</p> : null}
    </section>
  );
}

export function GameplayProductLobby({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-lobby">
      <ProductStatusBar model={model} />

      {model.auth.isWalletConnected ? <ProductIdentityCard model={model} /> : null}

      {model.shouldShowConnect ? <ConnectPanel model={model} /> : null}
      {model.shouldShowChainSwitch ? <ChainPanel model={model} /> : null}
      {model.shouldShowSignIn ? <SignInPanel model={model} /> : null}

      {model.shouldShowLobby ? (
        <>
          <ProductHero
            eyebrow="Operation Selection"
            title="Mission Protocols"
            description="Choose a run mode, manage separate keys for each ruleset, resume an existing run per mode, and return to the dungeon map without clutter."
          />
          <div className="product-mode-grid">
            {model.modeCards.map((mode) => (
              <RunModeCard key={mode.runType} mode={mode} />
            ))}
          </div>
          <BuyKeysPanel model={model} />
        </>
      ) : null}
    </section>
  );
}
