import { useState } from "react";

import { appConfig } from "../app/config";
import { AuthPanel } from "../features/auth/components/auth-panel";
import { GamePanel } from "../features/game/components/game-panel";
import { gameActionQueue } from "../features/realtime/game-action-queue";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function WorkbenchPage() {
  const [queueEvents, setQueueEvents] = useState<string[]>([]);

  async function enqueueDemoAction() {
    const queuedAtIso = new Date().toISOString();

    await gameActionQueue.enqueue(async () => {
      await sleep(250);
      setQueueEvents((current) => [`processed ${queuedAtIso}`, ...current].slice(0, 8));
    });
  }

  return (
    <main>
      <h1>MOG Client Workbench</h1>
      <p>Base URL: {appConfig.apiBaseUrl}</p>
      <p>
        Pusher: {appConfig.pusher.appKey} / {appConfig.pusher.cluster} / {appConfig.pusher.channel}
      </p>
      <p>
        SIWE: {appConfig.auth.siwe.domain} / chain {appConfig.auth.chainId}
      </p>

      <hr />
      <GamePanel />

      <hr />
      <AuthPanel />

      <hr />
      <section>
        <h2>Action Queue</h2>
        <p>In queue: {gameActionQueue.size}</p>
        <button type="button" onClick={() => void enqueueDemoAction()}>
          Enqueue demo action
        </button>
        <pre>{queueEvents.join("\n") || "-"}</pre>
      </section>
    </main>
  );
}
