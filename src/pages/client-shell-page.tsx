import { AppWalletProviders } from "../app/wallet-providers";
import { AuthPanel } from "../features/auth/components/auth-panel";
import { DevtoolsPanel } from "../features/dev/components/devtools-panel";
import { GamePanel } from "../features/game/components/game-panel";

export function ClientShellPage() {
  return (
    <AppWalletProviders>
      <main className="client-shell">
        <header className="client-shell-header">
          <div>
            <p className="panel-eyebrow">MOG Custom Client</p>
            <h1>Tryhard Runtime</h1>
            <p className="client-shell-subtitle">
              Gameplay first. State coherence, keyboard control, low-noise runtime.
            </p>
          </div>
        </header>

        <div className="client-shell-layout">
          <section className="client-shell-primary">
            <GamePanel />
          </section>

          <aside className="client-shell-sidebar">
            <section className="panel-stack">
              <header className="panel-header">
                <div>
                  <p className="panel-eyebrow">Meta</p>
                  <h2>Wallet & Session</h2>
                </div>
              </header>
              <div className="panel-card">
                <AuthPanel />
              </div>
            </section>

            <DevtoolsPanel />
          </aside>
        </div>
      </main>
    </AppWalletProviders>
  );
}
