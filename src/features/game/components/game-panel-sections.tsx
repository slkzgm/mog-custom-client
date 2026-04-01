import { moveControlOrder } from "../game-map";
import type { GamePanelModel } from "../runtime/use-game-panel-model";
import { formatDurationMs, formatGameError } from "../runtime/game-runtime.utils";
import { MapBoard } from "./map-board";

type StatusSectionModel = GamePanelModel["status"];
type RunSectionModel = GamePanelModel["run"];
type ResourcesSectionModel = GamePanelModel["resources"];
type BoardSectionModel = GamePanelModel["board"];
type UpgradesSectionModel = GamePanelModel["upgrades"];
type ControlsSectionModel = GamePanelModel["controls"];
type QueriesSectionModel = GamePanelModel["queries"];

export function GameStatusSection({ status }: { status: StatusSectionModel }) {
  return (
    <section className="panel-card">
      <h3>Status</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Paused</p>
          <p>{status.query.data?.paused ? "true" : "false"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Timestamp</p>
          <p>{status.query.data?.timestamp ?? "-"}</p>
        </div>
      </div>
      <div className="panel-actions">
        <button type="button" onClick={() => void status.query.refetch()}>
          Refresh status
        </button>
      </div>
      {status.query.isError ? <pre role="alert">status error: {formatGameError(status.query.error)}</pre> : null}
    </section>
  );
}

export function ActiveRunSection({
  run,
  queries,
}: {
  run: RunSectionModel;
  queries: QueriesSectionModel;
}) {
  return (
    <section className="panel-card">
      <h3>Active run</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Run ID</p>
          <p>{run.activeRunId ?? "-"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Has active run</p>
          <p>{run.activeRun ? "true" : "false"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Can resume</p>
          <p>{run.runStateQuery.data ? String(run.runStateQuery.data.canResume) : "-"}</p>
        </div>
      </div>
      <div className="panel-actions">
        <button type="button" onClick={() => void queries.activeRunQuery.refetch()}>
          Refresh active run
        </button>
        <button type="button" onClick={() => void run.handleResumeActiveRun()} disabled={!run.activeRunId || run.runStateQuery.isFetching}>
          Load active run state
        </button>
      </div>
      {run.activeRun ? <pre>{JSON.stringify(run.activeRun, null, 2)}</pre> : null}
      {queries.activeRunQuery.isError ? (
        <pre role="alert">active run error: {formatGameError(queries.activeRunQuery.error)}</pre>
      ) : null}
      {run.runStateQuery.isError ? <pre role="alert">run state error: {formatGameError(run.runStateQuery.error)}</pre> : null}
    </section>
  );
}

export function KeysSection({ resources }: { resources: ResourcesSectionModel }) {
  return (
    <section className="panel-card">
      <h3>Keys</h3>
      <p className="text-muted">buy price per key: 0.001 ETH</p>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Balance</p>
          <p>{resources.balanceQuery.data?.balance ?? "-"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Buy total</p>
          <p>{resources.buyKeys.buyKeysValueEth} ETH</p>
        </div>
      </div>
      <div className="panel-actions">
        <button type="button" onClick={() => void resources.balanceQuery.refetch()}>
          Refresh balance
        </button>
      </div>
      <div className="field-row">
        <label htmlFor="buy-keys-quantity-input">Buy quantity</label>
        <input
          id="buy-keys-quantity-input"
          value={resources.buyKeys.buyKeysQuantityInput}
          onChange={(event) => resources.buyKeys.setBuyKeysQuantityInput(event.target.value)}
          inputMode="numeric"
        />
      </div>
      <button type="button" onClick={() => void resources.buyKeys.handleBuyKeys()} disabled={!resources.buyKeys.canBuyKeys}>
        {resources.buyKeys.buyKeysMutation.isPending
          ? "Confirm in wallet..."
          : resources.buyKeys.isBuyKeysReceiptFetching
            ? "Confirming tx..."
            : "Buy keys (onchain)"}
      </button>
      <p>last buy tx hash: {resources.buyKeys.buyKeysMutation.data ?? "-"}</p>
      <p>last buy receipt: {resources.buyKeys.buyKeysReceiptQuery.data?.status ?? "-"}</p>
      {resources.buyKeys.buyKeysValidationError ? (
        <pre role="alert">buy keys validation: {resources.buyKeys.buyKeysValidationError}</pre>
      ) : null}
      {resources.balanceQuery.isError ? (
        <pre role="alert">balance error: {formatGameError(resources.balanceQuery.error)}</pre>
      ) : null}
      {resources.buyKeys.buyKeysMutation.isError ? (
        <pre role="alert">buy keys tx error: {formatGameError(resources.buyKeys.buyKeysMutation.error)}</pre>
      ) : null}
      {resources.buyKeys.buyKeysReceiptQuery.isError ? (
        <pre role="alert">buy keys receipt error: {formatGameError(resources.buyKeys.buyKeysReceiptQuery.error)}</pre>
      ) : null}
    </section>
  );
}

export function StartRunSection({ run }: { run: RunSectionModel }) {
  return (
    <section className="panel-card">
      <h3>Start run</h3>
      <div className="field-row">
        <label htmlFor="keys-amount-input">keysAmount</label>
        <input
          id="keys-amount-input"
          value={run.keysAmountInput}
          onChange={(event) => run.setKeysAmountInput(event.target.value)}
          inputMode="numeric"
        />
      </div>
      <div className="panel-actions">
        <button type="button" onClick={() => void run.handleStartRun()} disabled={!run.canStartRun}>
          {run.createRunMutation.isPending ? "Starting..." : "Start run"}
        </button>
      </div>
      <p>Last start run id: {run.createRunMutation.data?.runId ?? "-"}</p>
      <p>Last keys used: {run.createRunMutation.data?.keysUsed ?? "-"}</p>
      {run.startRunValidationError ? <pre role="alert">start run validation: {run.startRunValidationError}</pre> : null}
      {run.createRunMutation.isError ? (
        <pre role="alert">start run error: {formatGameError(run.createRunMutation.error)}</pre>
      ) : null}
    </section>
  );
}

export function BoardSection({
  run,
  board,
  upgrades,
  controls,
}: {
  run: RunSectionModel;
  board: BoardSectionModel;
  upgrades: UpgradesSectionModel;
  controls: ControlsSectionModel;
}) {
  return (
    <section className="panel-card">
      <h3>Map</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Snapshot</p>
          <p>{run.snapshotSource}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Floor / Turn</p>
          <p>
            {run.effectiveGameState?.currentFloor ?? "-"} / {run.effectiveGameState?.turnNumber ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Run ID</p>
          <p>{run.effectiveGameState?.runId ?? "-"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Status</p>
          <p>{run.effectiveGameState?.status ?? "-"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Time played</p>
          <p>{formatDurationMs(run.effectiveGameState?.timePlayed ?? null)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Last action latency</p>
          <p>{run.metrics.lastActionLatencyMs ?? "-"} ms</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Map size</p>
          <p>
            {board.mapWidth}x{board.mapHeight} ({board.totalCells})
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Fog</p>
          <p>
            h={board.fogCounts.hidden} e={board.fogCounts.explored} v={board.fogCounts.visible}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Tiles</p>
          <p>
            w={board.tileCounts.wall} hw={board.tileCounts.hardWall} c={board.tileCounts.corridor}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Boss state</p>
          <p>{board.skDefeatedText}</p>
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card-label">Player pos</p>
          <p>{board.player ? `${board.player.x},${board.player.y}` : "-"}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Energy</p>
          <p>
            {board.player?.energy ?? "-"} / {board.player?.maxEnergy ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Treasure / Marbles</p>
          <p>
            {board.player?.treasure ?? "-"} / {board.player?.marbles ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Attack</p>
          <p>
            {board.player?.attackPower ?? "-"} (base {board.player?.baseAttackPower ?? "-"})
          </p>
        </div>
      </div>
      <p className="text-muted">upgrades: {board.player?.upgrades.length ? board.player.upgrades.join(", ") : "-"}</p>
      <p className="text-muted">
        active buffs:{" "}
        {board.player?.activeBuffs.length ? board.player.activeBuffs.map((buff) => `${buff.key}=${String(buff.value)}`).join(", ") : "-"}
      </p>
      {run.effectiveGameState ? (
        <MapBoard
          gameState={run.effectiveGameState}
          onDirectionalAction={controls.handleMove}
          onPassAction={controls.handlePass}
          isActionLocked={upgrades.hasPendingUpgradeSelection || controls.isAnyActionPending}
        />
      ) : (
        <p>No local map yet.</p>
      )}
    </section>
  );
}

export function DebugDataSection({
  run,
  board,
}: {
  run: RunSectionModel;
  board: BoardSectionModel;
}) {
  return (
    <div className="stack-list">
      <details>
        <summary>ASCII map</summary>
        {board.mapLines.length > 0 ? <pre>{board.mapLines.join("\n")}</pre> : <p>-</p>}
      </details>
      <details>
        <summary>Entities</summary>
        <div className="stack-list">
          <div>
            <p>Enemies</p>
            {board.enemyLines.length > 0 ? <pre>{board.enemyLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Interactive</p>
            {board.interactiveLines.length > 0 ? <pre>{board.interactiveLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Torches</p>
            {board.torchLines.length > 0 ? <pre>{board.torchLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Portals</p>
            {board.portalLines.length > 0 ? <pre>{board.portalLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Pickups</p>
            {board.pickupLines.length > 0 ? <pre>{board.pickupLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Traps</p>
            {board.trapLines.length > 0 ? <pre>{board.trapLines.join("\n")}</pre> : <p>-</p>}
          </div>
          <div>
            <p>Arrow traps</p>
            {board.arrowTrapLines.length > 0 ? <pre>{board.arrowTrapLines.join("\n")}</pre> : <p>-</p>}
          </div>
        </div>
      </details>
      {run.lastMoveEvents.length > 0 ? <pre>{JSON.stringify(run.lastMoveEvents, null, 2)}</pre> : null}
    </div>
  );
}

export function UpgradeSection({
  upgrades,
  controls,
}: {
  upgrades: UpgradesSectionModel;
  controls: ControlsSectionModel;
}) {
  return (
    <section className="panel-card">
      <h3>Upgrade Selection</h3>
      <p>pending selection: {upgrades.hasPendingUpgradeSelection ? "true" : "false"}</p>
      <p>options: {upgrades.pendingUpgradeOptions.length ? upgrades.pendingUpgradeOptions.join(", ") : "-"}</p>
      <p>next reroll cost: {upgrades.nextRerollCost ?? "-"}</p>
      <p>
        reroll affordable: {upgrades.canEstimateNextRerollCost ? (upgrades.hasEnoughTreasureForReroll ? "yes" : "no") : "-"}
      </p>
      <div className="panel-actions">
        <button
          type="button"
          onClick={() => void upgrades.handleRerollUpgrades()}
          disabled={upgrades.isRerollDisabled}
          title={upgrades.rerollValidationError ?? "Reroll options"}
        >
          {upgrades.runRerollMutation.isPending ? "Rerolling..." : "Reroll options"}
        </button>
        {upgrades.pendingUpgradeOptions.map((upgradeId) => (
          <button
            key={upgradeId}
            type="button"
            onClick={() => void upgrades.handleSelectUpgrade(upgradeId)}
            disabled={!controls.moveRunId || upgrades.runRerollMutation.isPending || upgrades.selectUpgradeMutation.isPending}
          >
            Select {upgradeId}
          </button>
        ))}
      </div>
      {upgrades.rerollValidationError ? <pre role="alert">reroll validation: {upgrades.rerollValidationError}</pre> : null}
      <p>last reroll success: {upgrades.runRerollMutation.data ? String(upgrades.runRerollMutation.data.success) : "-"}</p>
      <p>last reroll cost: {upgrades.runRerollMutation.data?.treasureCost ?? "-"}</p>
      <p>last reroll treasure: {upgrades.runRerollMutation.data?.newTreasure ?? "-"}</p>
      <p>last reroll count: {upgrades.runRerollMutation.data?.currentRerollCount ?? "-"}</p>
      {upgrades.runRerollMutation.isError ? (
        <pre role="alert">reroll error: {formatGameError(upgrades.runRerollMutation.error)}</pre>
      ) : null}
      {upgrades.selectUpgradeMutation.isError ? (
        <pre role="alert">upgrade select error: {formatGameError(upgrades.selectUpgradeMutation.error)}</pre>
      ) : null}
    </section>
  );
}

export function MoveControlsSection({ controls }: { controls: ControlsSectionModel }) {
  const passValidationError = controls.validatePass();
  const isPassDisabled = Boolean(passValidationError) || controls.isAnyActionPending;

  return (
    <section className="panel-card">
      <h3>Move</h3>
      <p>runId used for move: {controls.moveRunId ?? "-"}</p>
      <p className="text-muted">Shortcuts: W/A/S/D = move, Space = skip.</p>
      <div className="panel-actions">
        <button type="button" onClick={() => void controls.handlePass()} disabled={isPassDisabled} title={passValidationError ?? "Pass turn"}>
          Skip
        </button>
        {moveControlOrder.map((control) => {
          const moveValidationError = controls.validateMove(control.direction);
          const isDisabled = Boolean(moveValidationError) || controls.isAnyActionPending;

          return (
            <button
              key={control.direction}
              type="button"
              onClick={() => void controls.handleMove(control.direction)}
              disabled={isDisabled}
              title={moveValidationError ?? controls.getDirectionalActionLabel(control.direction)}
            >
              {control.label}
            </button>
          );
        })}
      </div>
      <p>Last move success: {controls.runMoveMutation.data ? String(controls.runMoveMutation.data.success) : "-"}</p>
      <p>Last move game over: {controls.runMoveMutation.data ? String(controls.runMoveMutation.data.isGameOver) : "-"}</p>
      {controls.runMoveMutation.isError ? (
        <pre role="alert">move error: {formatGameError(controls.runMoveMutation.error)}</pre>
      ) : null}
    </section>
  );
}
