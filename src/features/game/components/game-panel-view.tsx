import type { GamePanelModel } from "../runtime/use-game-panel-model";
import {
  ActiveRunSection,
  BoardSection,
  DebugDataSection,
  GameStatusSection,
  KeysSection,
  MoveControlsSection,
  StartRunSection,
  UpgradeSection,
} from "./game-panel-sections";

export function GamePanelView({ model }: { model: GamePanelModel }) {
  return (
    <section className="panel-stack">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Gameplay</p>
          <h2>Run Control</h2>
        </div>
      </header>

      <div className="gameplay-screen-layout">
        <div className="gameplay-screen-main">
          <BoardSection run={model.run} board={model.board} upgrades={model.upgrades} controls={model.controls} />
          <div className="panel-grid panel-grid-two">
            <UpgradeSection upgrades={model.upgrades} controls={model.controls} />
            <MoveControlsSection controls={model.controls} />
          </div>
        </div>

        <aside className="gameplay-screen-sidebar">
          <GameStatusSection status={model.status} />
          <ActiveRunSection run={model.run} queries={model.queries} />
          <StartRunSection run={model.run} />
          <KeysSection resources={model.resources} />
        </aside>
      </div>

      <details className="panel-card">
        <summary>Debug data</summary>
        <DebugDataSection run={model.run} board={model.board} />
      </details>

      <div className="panel-actions">
        <button type="button" onClick={() => void model.run.refreshAll()} disabled={model.controls.isRefreshDisabled}>
          Refresh all
        </button>
      </div>
    </section>
  );
}
