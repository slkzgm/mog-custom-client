import { ApiError } from "../../../lib/http/api-error";

export function formatGameError(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code ? ` [${error.code}]` : "";
    return `${error.status}${code} ${error.message}`.trim();
  }

  if (error instanceof Error) return error.message;
  return "Unknown error";
}

export function parseIntegerInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function validateStartRunInput(params: {
  parsedKeysAmount: number | null;
  balance: number | null | undefined;
  hasActiveRun: boolean;
}): string | null {
  if (params.hasActiveRun) {
    return "A run is already active. Finish it before starting a new run.";
  }

  if (params.parsedKeysAmount === null) {
    return "keysAmount must be an integer.";
  }

  if (params.parsedKeysAmount < 1) {
    return "keysAmount must be >= 1.";
  }

  if (typeof params.balance === "number" && params.parsedKeysAmount > params.balance) {
    return "keysAmount exceeds current balance.";
  }

  return null;
}

export function formatDurationMs(value: number | null): string {
  if (value === null || value < 0) return "-";

  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function countTileKinds(mapData: number[][] | null) {
  const counts = {
    wall: 0,
    hardWall: 0,
    corridor: 0,
    other: 0,
  };

  if (!mapData) return counts;

  for (const row of mapData) {
    for (const tile of row) {
      if (tile === 2) counts.hardWall += 1;
      else if (tile === 1) counts.wall += 1;
      else if (tile === 0) counts.corridor += 1;
      else counts.other += 1;
    }
  }

  return counts;
}

export function countFogMask(fogMask: number[][] | null) {
  const counts = {
    hidden: 0,
    explored: 0,
    visible: 0,
  };

  if (!fogMask) return counts;

  for (const row of fogMask) {
    for (const cell of row) {
      if (cell === 0) counts.hidden += 1;
      else if (cell === 1) counts.explored += 1;
      else if (cell >= 2) counts.visible += 1;
    }
  }

  return counts;
}

export function shouldIgnoreGameplayHotkey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return true;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(target.closest("input, textarea, select, button, [contenteditable]"));
}

export function estimateNextRerollCost(currentRerollCount: number | null | undefined): number | null {
  if (typeof currentRerollCount !== "number" || !Number.isSafeInteger(currentRerollCount)) return null;
  if (currentRerollCount < 0) return null;

  const nextRerollNumber = currentRerollCount + 1;
  if (nextRerollNumber === 1) return 10;
  if (nextRerollNumber === 2) return 20;

  let previousCost = 10;
  let currentCost = 20;

  for (let rerollNumber = 3; rerollNumber <= nextRerollNumber; rerollNumber += 1) {
    const nextCost = previousCost + currentCost;
    if (!Number.isSafeInteger(nextCost)) return null;
    previousCost = currentCost;
    currentCost = nextCost;
  }

  return currentCost;
}
