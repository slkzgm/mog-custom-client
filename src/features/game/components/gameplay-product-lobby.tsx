import { shortenAddress } from "../../auth/use-auth-controller";
import { getRunModeDefinition } from "../game-modes";
import type { GameplayProductScreenModel } from "../runtime/use-gameplay-product-screen-model";
import { formatCurrentMaxValue } from "../runtime/game-runtime.utils";

function formatUpgradesPerFloor(upgradesPerFloor: Record<string, string>) {
  const entries = Object.entries(upgradesPerFloor).sort(([leftFloor], [rightFloor]) => Number(leftFloor) - Number(rightFloor));
  if (entries.length === 0) return "No upgrades recorded";
  return entries.map(([floor, upgrade]) => `F${floor}: ${upgrade}`).join(" • ");
}

interface GameplayProductLobbyProps {
  model: GameplayProductScreenModel;
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
  const actionLabel = mode.hasLoadedRunState ? "Open Run" : mode.hasActiveRun ? "Resume Run" : "Start Run";
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

function RunHistoryPanel({ model }: GameplayProductLobbyProps) {
  if (model.completedRunHistory.length === 0) return null;

  return (
    <section className="product-card product-history-card">
      <div className="product-mode-card-header">
        <span className="product-card-label">Local History</span>
        <button type="button" className="product-button product-button-ghost" onClick={model.clearCompletedRunHistory}>
          Clear
        </button>
      </div>
      <h2>Recent Runs</h2>
      <div className="product-history-list">
        {model.completedRunHistory.slice(0, 8).map((entry) => {
          const mode = getRunModeDefinition(entry.runType ?? "NORMAL");

          return (
            <article key={`${entry.runId ?? "run"}:${entry.endedAt}`} className="product-history-entry">
              <div className="product-history-entry-header">
                <strong>{mode.label}</strong>
                <span>{entry.outcome === "victory" ? "Victory" : "Run Ended"}</span>
              </div>
              <div className="product-history-entry-grid">
                <div>
                  <span>{mode.rewardLabel}</span>
                  <strong>{entry.rewardValue ?? "-"}</strong>
                </div>
                <div>
                  <span>Marbles</span>
                  <strong>{entry.marbles ?? "-"}</strong>
                </div>
                <div>
                  <span>Keys</span>
                  <strong>{entry.keysUsed ?? "-"}</strong>
                </div>
                <div>
                  <span>Skeleton King</span>
                  <strong>{entry.skDefeated ? "Killed" : "Alive"}</strong>
                </div>
                <div>
                  <span>Floor</span>
                  <strong>{entry.currentFloor ?? "-"}</strong>
                </div>
                <div>
                  <span>Turn</span>
                  <strong>{entry.turnNumber ?? "-"}</strong>
                </div>
                <div>
                  <span>Rerolls</span>
                  <strong>{entry.rerollCount ?? 0}</strong>
                </div>
                <div>
                  <span>Energy</span>
                  <strong>{formatCurrentMaxValue(entry.energy, entry.maxEnergy)}</strong>
                </div>
              </div>
              <p className="product-card-note">{formatUpgradesPerFloor(entry.upgradesPerFloor)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function GameplayProductLobby({ model }: GameplayProductLobbyProps) {
  return (
    <section className="product-lobby">
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
          <RunHistoryPanel model={model} />
        </>
      ) : null}
    </section>
  );
}
