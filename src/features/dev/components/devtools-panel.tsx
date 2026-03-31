import { useState } from "react";

import { appConfig } from "../../../app/config";
import { gameActionQueue } from "../../realtime/game-action-queue";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function DevtoolsPanel() {
  const [queueEvents, setQueueEvents] = useState<string[]>([]);

  async function enqueueDemoAction() {
    const queuedAtIso = new Date().toISOString();

    await gameActionQueue.enqueue(async () => {
      await sleep(250);
      setQueueEvents((current) => [`processed ${queuedAtIso}`, ...current].slice(0, 8));
    });
  }

  return (
    <section className="panel-stack">
      <header className="panel-header">
        <div>
          <p className="panel-eyebrow">Dev</p>
          <h2>Runtime Tools</h2>
        </div>
      </header>

      <div className="panel-card">
        <h3>Config</h3>
        <p>Base URL: {appConfig.apiBaseUrl}</p>
        <p>
          Pusher: {appConfig.pusher.appKey} / {appConfig.pusher.cluster} / {appConfig.pusher.channel}
        </p>
        <p>
          SIWE: {appConfig.auth.siwe.domain} / chain {appConfig.auth.chainId}
        </p>
      </div>

      <div className="panel-card">
        <h3>Action Queue</h3>
        <p>In queue: {gameActionQueue.size}</p>
        <button type="button" onClick={() => void enqueueDemoAction()}>
          Enqueue demo action
        </button>
        <pre>{queueEvents.join("\n") || "-"}</pre>
      </div>
    </section>
  );
}
