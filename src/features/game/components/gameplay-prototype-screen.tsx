import { AuthPanel } from "../../auth/components/auth-panel";
import { useGamePanelModel } from "../runtime/use-game-panel-model";
import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";
import { MapBoardV2 } from "./map-board-v2";

function OverlayStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="gameplay-overlay-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function describeEvent(event: Record<string, unknown>): string {
  const type = typeof event.type === "string" ? event.type : null;
  const target = typeof event.targetId === "string" ? event.targetId : typeof event.targetEnemyId === "string" ? event.targetEnemyId : null;
  const value =
    typeof event.value === "number" ? String(event.value) : typeof event.damage === "number" ? String(event.damage) : null;

  if (type && target && value) return `${type} ${target} (${value})`;
  if (type && target) return `${type} ${target}`;
  if (type && value) return `${type} (${value})`;
  if (type) return type;

  const compact = JSON.stringify(event);
  return compact.length > 72 ? `${compact.slice(0, 69)}...` : compact;
}

export function GameplayPrototypeScreen() {
  const model = useGamePanelModel();

  useGameplayHotkeys({
    disabled: model.controls.hotkeysDisabled,
    onMove: model.controls.handleMove,
    onPass: model.controls.handlePass,
  });

  const runState = model.run.effectiveGameState;
  const player = model.board.player;
  const passValidationError = model.controls.validatePass();

  if (!runState) {
    return (
      <section className="gameplay-prototype gameplay-prototype-empty">
        <header className="gameplay-prototype-header gameplay-prototype-header-immersive">
          <div>
            <p className="panel-eyebrow">Gameplay Prototype</p>
            <h1>Map-first client</h1>
            <p className="client-shell-subtitle">La board deviendra l’écran principal. Ce mode sert de point de départ.</p>
          </div>
        </header>

        <div className="gameplay-prototype-empty-layout">
          <section className="panel-card gameplay-prototype-launcher">
            <h2>Launch or resume a run</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <p className="stat-card-label">Active run</p>
                <p>{model.run.activeRunId ?? "-"}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-label">Keys balance</p>
                <p>{model.resources.balanceQuery.data?.balance ?? "-"}</p>
              </div>
            </div>
            <div className="field-row">
              <label htmlFor="prototype-keys-amount-input">keysAmount</label>
              <input
                id="prototype-keys-amount-input"
                value={model.run.keysAmountInput}
                onChange={(event) => model.run.setKeysAmountInput(event.target.value)}
                inputMode="numeric"
              />
            </div>
            <div className="panel-actions">
              <button type="button" onClick={() => void model.run.handleStartRun()} disabled={!model.run.canStartRun}>
                {model.run.createRunMutation.isPending ? "Starting..." : "Start run"}
              </button>
              <button
                type="button"
                onClick={() => void model.run.handleResumeActiveRun()}
                disabled={!model.run.activeRunId || model.run.runStateQuery.isFetching}
              >
                Resume active run
              </button>
            </div>
            {model.run.startRunValidationError ? (
              <pre role="alert">start run validation: {model.run.startRunValidationError}</pre>
            ) : null}
          </section>

          <details className="panel-card">
            <summary>Session tools</summary>
            <AuthPanel />
          </details>
        </div>
      </section>
    );
  }

  return (
    <section className="gameplay-fullscreen">
      <div className="gameplay-fullscreen-stage">
        <MapBoardV2
          gameState={runState}
          onDirectionalAction={model.controls.handleMove}
          onPassAction={model.controls.handlePass}
          isActionLocked={model.upgrades.hasPendingUpgradeSelection || model.controls.isAnyActionPending}
        />

        <header className="gameplay-overlay gameplay-overlay-top">
          <div className="gameplay-overlay-brand">
            <p className="panel-eyebrow">Gameplay Prototype</p>
            <h1>Dungeon run</h1>
          </div>
          <div className="gameplay-overlay-topbar">
            <OverlayStat label="Floor" value={runState.currentFloor ?? "-"} />
            <OverlayStat label="Turn" value={runState.turnNumber ?? "-"} />
            <OverlayStat label="Energy" value={player?.energy ?? "-"} />
            <OverlayStat label="Treasure" value={player?.treasure ?? "-"} />
            <OverlayStat label="Attack" value={player?.attackPower ?? "-"} />
          </div>
        </header>

        <aside className="gameplay-overlay gameplay-overlay-left">
          <div className="gameplay-overlay-panel">
            <p className="panel-eyebrow">Run</p>
            <div className="gameplay-overlay-kv">
              <span>Position</span>
              <strong>{player ? `${player.x}, ${player.y}` : "-"}</strong>
            </div>
            <div className="gameplay-overlay-kv">
              <span>Enemies</span>
              <strong>{runState.enemies.length}</strong>
            </div>
            <div className="gameplay-overlay-kv">
              <span>Kills</span>
              <strong>{player?.totalEnemiesKilled ?? "-"}</strong>
            </div>
            <div className="gameplay-overlay-kv">
              <span>Marbles</span>
              <strong>{player?.marbles ?? "-"}</strong>
            </div>
          </div>
        </aside>

        <aside className="gameplay-overlay gameplay-overlay-right">
          <div className="gameplay-overlay-panel">
            <p className="panel-eyebrow">Activity</p>
            {model.run.lastMoveEvents.length > 0 ? (
              <div className="gameplay-overlay-feed">
                {model.run.lastMoveEvents.slice(-5).reverse().map((event, index) => (
                  <div key={`${index}-${describeEvent(event)}`} className="gameplay-overlay-feed-item">
                    {describeEvent(event)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted">No recent events.</p>
            )}
          </div>
        </aside>

        {model.upgrades.hasPendingUpgradeSelection ? (
          <section className="gameplay-overlay gameplay-overlay-upgrade">
            <div className="gameplay-overlay-panel gameplay-overlay-panel-upgrade">
              <p className="panel-eyebrow">Upgrade</p>
              <h2>Choose an upgrade</h2>
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
                    disabled={!model.controls.moveRunId || model.upgrades.runRerollMutation.isPending || model.upgrades.selectUpgradeMutation.isPending}
                  >
                    {upgradeId}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <footer className="gameplay-overlay gameplay-overlay-bottom">
          <div className="gameplay-action-strip">
            <button type="button" onClick={() => void model.controls.handleMove("up")} disabled={Boolean(model.controls.validateMove("up")) || model.controls.isAnyActionPending}>
              Up
            </button>
            <button
              type="button"
              onClick={() => void model.controls.handleMove("left")}
              disabled={Boolean(model.controls.validateMove("left")) || model.controls.isAnyActionPending}
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => void model.controls.handlePass()}
              disabled={Boolean(passValidationError) || model.controls.isAnyActionPending}
              title={passValidationError ?? "Skip turn"}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => void model.controls.handleMove("right")}
              disabled={Boolean(model.controls.validateMove("right")) || model.controls.isAnyActionPending}
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => void model.controls.handleMove("down")}
              disabled={Boolean(model.controls.validateMove("down")) || model.controls.isAnyActionPending}
            >
              Down
            </button>
          </div>
          <div className="gameplay-overlay-hint">
            <span>W/A/S/D to move</span>
            <span>Space to skip</span>
            <button type="button" onClick={() => void model.run.refreshAll()} disabled={model.controls.isRefreshDisabled}>
              Refresh
            </button>
          </div>
        </footer>
      </div>

      <details className="panel-card gameplay-prototype-secondary">
        <summary>Secondary panels</summary>
        <div className="panel-grid panel-grid-two">
          <div className="panel-card">
            <h3>Resources</h3>
            <p>keys balance: {model.resources.balanceQuery.data?.balance ?? "-"}</p>
            <p>hongbao: {player?.hongbao ?? "-"}</p>
            <p>last action latency: {model.run.metrics.lastActionLatencyMs ?? "-"} ms</p>
          </div>
          <div className="panel-card">
            <h3>Session</h3>
            <p>active run: {model.run.activeRunId ?? "-"}</p>
            <p>can resume: {model.run.runStateQuery.data ? String(model.run.runStateQuery.data.canResume) : "-"}</p>
          </div>
        </div>
        <details className="panel-card">
          <summary>Session tools</summary>
          <AuthPanel />
        </details>
      </details>
    </section>
  );
}
