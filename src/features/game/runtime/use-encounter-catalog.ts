import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import type { GameStateSnapshot } from "../game.types";
import {
  createEmptyEncounterCatalog,
  mergeEncounterCatalogs,
  recordGameStateEncounters,
  sanitizeEncounterCatalog,
  summarizeEncounterCatalog,
} from "./encounter-catalog";

const STORAGE_KEY = "mog.dev.encounter-catalog.v1";
const DEV_ENDPOINT = "/__dev/encounter-catalog";

type SyncState = "local" | "syncing" | "synced" | "error";

interface DevCatalogResponse {
  catalog?: unknown;
  filePath?: string;
}

const emptySummary = summarizeEncounterCatalog(createEmptyEncounterCatalog());

function loadLocalCatalog() {
  if (typeof window === "undefined") return createEmptyEncounterCatalog();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyEncounterCatalog();
    return sanitizeEncounterCatalog(JSON.parse(raw));
  } catch {
    return createEmptyEncounterCatalog();
  }
}

type CatalogAction =
  | { type: "recordSnapshot"; gameState: GameStateSnapshot }
  | { type: "mergePersisted"; catalog: ReturnType<typeof createEmptyEncounterCatalog> };

function catalogReducer(state: ReturnType<typeof createEmptyEncounterCatalog>, action: CatalogAction) {
  if (action.type === "recordSnapshot") {
    return recordGameStateEncounters(state, action.gameState);
  }

  return mergeEncounterCatalogs(state, action.catalog);
}

export function useEncounterCatalog(gameState: GameStateSnapshot | null, enabled: boolean) {
  const [catalog, dispatchCatalog] = useReducer(catalogReducer, undefined, loadLocalCatalog);
  const [syncState, setSyncState] = useState<SyncState>(enabled && import.meta.env.DEV ? "syncing" : "local");
  const [devFilePath, setDevFilePath] = useState<string | null>(null);
  const hasLoadedDevCatalogRef = useRef(false);
  const lastPostedPayloadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!gameState) return;

    dispatchCatalog({ type: "recordSnapshot", gameState });
  }, [enabled, gameState]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
    } catch {
      // Best-effort cache only.
    }
  }, [catalog, enabled]);

  useEffect(() => {
    if (!enabled || !import.meta.env.DEV || hasLoadedDevCatalogRef.current) return;
    hasLoadedDevCatalogRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(DEV_ENDPOINT);
        if (!response.ok) {
          if (!cancelled) setSyncState("error");
          return;
        }

        const payload = (await response.json()) as DevCatalogResponse;
        if (cancelled) return;

        if (payload.filePath) {
          setDevFilePath(payload.filePath);
        }

        if (payload.catalog) {
          const nextRemoteCatalog = sanitizeEncounterCatalog(payload.catalog);
          dispatchCatalog({ type: "mergePersisted", catalog: nextRemoteCatalog });
        }

        setSyncState("synced");
      } catch {
        if (!cancelled) {
          setSyncState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !import.meta.env.DEV || !catalog.updatedAt) return;

    const payload = JSON.stringify(catalog);
    if (payload === lastPostedPayloadRef.current) return;

    let cancelled = false;

    void (async () => {
      try {
        await Promise.resolve();
        if (cancelled) return;

        setSyncState("syncing");

        const response = await fetch(DEV_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: payload,
        });

        if (!response.ok) {
          if (!cancelled) setSyncState("error");
          return;
        }

        const body = (await response.json()) as DevCatalogResponse;
        if (cancelled) return;

        if (body.filePath) {
          setDevFilePath(body.filePath);
        }

        lastPostedPayloadRef.current = payload;
        setSyncState("synced");
      } catch {
        if (!cancelled) {
          setSyncState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalog, enabled]);

  const summary = useMemo(() => summarizeEncounterCatalog(catalog), [catalog]);

  if (!enabled) {
    return {
      catalog: createEmptyEncounterCatalog(),
      summary: emptySummary,
      syncState: "local" as const,
      devFilePath: null,
    };
  }

  return {
    catalog,
    summary,
    syncState,
    devFilePath,
  };
}
