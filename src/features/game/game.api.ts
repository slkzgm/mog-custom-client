import { apiRequest } from "../../lib/http/api-client";
import type {
  ActiveRunSnapshot,
  CreateRunResult,
  EnemySnapshot,
  GameBuffSnapshot,
  GamePlayerSnapshot,
  GameStateSnapshot,
  GameStatus,
  KeysBalance,
  MapEntitySnapshot,
  MoveRunParams,
  MoveRunResult,
  RunRerollResult,
  RunStateSnapshot,
  SelectUpgradeParams,
  TorchSnapshot,
} from "./game.types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickFirstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function pickFirstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function pickBoolean(source: Record<string, unknown>, key: string): boolean {
  return source[key] === true;
}

function pickBooleanOrNull(source: Record<string, unknown>, key: string): boolean | null {
  const value = source[key];
  if (typeof value === "boolean") return value;
  return null;
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  const records: Record<string, unknown>[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (record) records.push(record);
  }
  return records;
}

function toNumberMatrix(value: unknown): number[][] | null {
  if (!Array.isArray(value)) return null;

  const matrix: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) return null;

    const parsedRow: number[] = [];
    for (const cell of row) {
      if (typeof cell !== "number" || !Number.isFinite(cell)) return null;
      parsedRow.push(cell);
    }

    matrix.push(parsedRow);
  }

  return matrix;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      result.push(item.trim());
      continue;
    }

    const record = asRecord(item);
    if (!record) continue;

    const label = pickFirstString(record, ["name", "label", "id", "type"]);
    if (label) {
      result.push(label);
    }
  }

  return result;
}

function toActiveBuffs(value: unknown): GameBuffSnapshot[] {
  const source = asRecord(value);
  if (!source) return [];

  const activeBuffs: GameBuffSnapshot[] = [];
  const keys = Object.keys(source).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    const rawValue = source[key];

    if (typeof rawValue === "boolean" && rawValue) {
      activeBuffs.push({ key, value: true });
      continue;
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0) {
      activeBuffs.push({ key, value: rawValue });
      continue;
    }

    if (typeof rawValue === "string" && rawValue.trim()) {
      activeBuffs.push({ key, value: rawValue.trim() });
    }
  }

  return activeBuffs;
}

function toGamePlayer(value: unknown): GamePlayerSnapshot | null {
  const source = asRecord(value);
  if (!source) return null;

  const x = pickFirstNumber(source, ["x"]);
  const y = pickFirstNumber(source, ["y"]);
  if (x === null || y === null) return null;

  return {
    x,
    y,
    energy: pickFirstNumber(source, ["energy"]),
    maxEnergy: pickFirstNumber(source, ["maxEnergy"]),
    treasure: pickFirstNumber(source, ["treasure"]),
    marbles: pickFirstNumber(source, ["marbles"]),
    hongbao: pickFirstNumber(source, ["hongbao"]),
    baseAttackPower: pickFirstNumber(source, ["baseAttackPower"]),
    attackPower: pickFirstNumber(source, ["attackPower"]),
    totalEnergySpent: pickFirstNumber(source, ["totalEnergySpent"]),
    totalEnemiesKilled: pickFirstNumber(source, ["totalEnemiesKilled"]),
    upgrades: toStringArray(source.upgrades),
    activeBuffs: toActiveBuffs(source.buffs),
    buffsRaw: asRecord(source.buffs) ?? {},
  };
}

function toMapEntityList(value: unknown, fallbackType: string): MapEntitySnapshot[] {
  const source = toRecordArray(value);

  const entities: MapEntitySnapshot[] = [];
  for (const item of source) {
    const x = pickFirstNumber(item, ["x"]);
    const y = pickFirstNumber(item, ["y"]);
    if (x === null || y === null) continue;

    entities.push({
      x,
      y,
      type: pickFirstString(item, ["type"]) ?? fallbackType,
      id: pickFirstString(item, ["id"]),
      value: pickFirstNumber(item, ["value"]),
      damage: pickFirstNumber(item, ["damage"]),
      tileIndex: pickFirstNumber(item, ["tileIndex"]),
    });
  }

  return entities;
}

function toEnemyList(value: unknown): EnemySnapshot[] {
  const source = toRecordArray(value);
  const enemies: EnemySnapshot[] = [];

  for (const item of source) {
    const x = pickFirstNumber(item, ["x"]);
    const y = pickFirstNumber(item, ["y"]);
    if (x === null || y === null) continue;

    enemies.push({
      x,
      y,
      type: pickFirstString(item, ["type", "spriteType"]) ?? "enemy",
      id: pickFirstString(item, ["id"]),
      value: null,
      damage: pickFirstNumber(item, ["damage"]),
      tileIndex: null,
      hp: pickFirstNumber(item, ["hp"]),
      maxHp: pickFirstNumber(item, ["maxHp"]),
      spriteType: pickFirstString(item, ["spriteType"]),
      moveCooldown: pickFirstNumber(item, ["moveCooldown"]),
      hasHeavyHit: item.hasHeavyHit === true,
      isChargingHeavy: item.isChargingHeavy === true,
      patternDirection: pickFirstString(item, ["patternDirection"]),
      patternMovingPositive:
        typeof item.patternMovingPositive === "boolean" ? item.patternMovingPositive : null,
      canPassThroughWalls:
        typeof item.canPassThroughWalls === "boolean" ? item.canPassThroughWalls : null,
    });
  }

  return enemies;
}

function toTorchList(value: unknown): TorchSnapshot[] {
  const source = toRecordArray(value);
  const torches: TorchSnapshot[] = [];

  for (const item of source) {
    const x = pickFirstNumber(item, ["x"]);
    const y = pickFirstNumber(item, ["y"]);
    if (x === null || y === null) continue;

    torches.push({
      x,
      y,
      type: "torch",
      id: pickFirstString(item, ["id"]),
      value: null,
      damage: null,
      tileIndex: null,
      isRevealed: typeof item.isRevealed === "boolean" ? item.isRevealed : null,
    });
  }

  return torches;
}

function pickArrayLength(value: unknown): number | null {
  if (!Array.isArray(value)) return null;
  return value.length;
}

function toGameState(payload: unknown): GameStateSnapshot | null {
  const source = asRecord(payload);
  if (!source) return null;
  const pendingUpgradeOptions = toStringArray(source.pendingUpgradeOptions);

  return {
    runId: pickFirstString(source, ["runId", "id"]),
    userId: pickFirstString(source, ["userId"]),
    status: pickFirstString(source, ["status"]),
    keysUsed: pickFirstNumber(source, ["keysUsed", "keysAmount"]),
    currentFloor: pickFirstNumber(source, ["currentFloor"]),
    turnNumber: pickFirstNumber(source, ["turnNumber"]),
    timePlayed: pickFirstNumber(source, ["timePlayed"]),
    createdAt: pickFirstString(source, ["createdAt"]),
    lastActionAt: pickFirstString(source, ["lastActionAt"]),
    currentRerollCount: pickFirstNumber(source, ["currentRerollCount"]),
    nextRerollCost: pickFirstNumber(source, ["nextRerollCost", "rerollCost", "nextUpgradeRerollCost"]),
    teleportUseCount: pickFirstNumber(source, ["teleportUseCount"]),
    skDefeated: pickBooleanOrNull(source, "skDefeated"),
    pendingUpgradeCount:
      pickArrayLength(source.pendingUpgradeOptions) ??
      (pendingUpgradeOptions.length > 0 ? pendingUpgradeOptions.length : 0),
    pendingUpgradeOptions,
    player: toGamePlayer(source.player),
    mapData: toNumberMatrix(source.mapData),
    tileData: toNumberMatrix(source.tileData),
    fogMask: toNumberMatrix(source.fogMask),
    enemies: toEnemyList(source.enemies),
    interactive: toMapEntityList(source.interactive, "interactive"),
    torches: toTorchList(source.torches),
    portals: toMapEntityList(source.portals, "portal"),
    pickups: toMapEntityList(source.pickups, "pickup"),
    traps: toMapEntityList(source.traps, "trap"),
    arrowTraps: toMapEntityList(source.arrowTraps, "arrow-trap"),
    raw: source,
  };
}

export async function fetchGameStatus(): Promise<GameStatus> {
  const payload = await apiRequest<unknown>("status", {
    method: "GET",
    credentials: "include",
  });
  const source = asRecord(payload);

  if (!source) {
    return {
      paused: false,
      timestamp: null,
    };
  }

  return {
    paused: pickBoolean(source, "paused"),
    timestamp: pickFirstNumber(source, ["timestamp"]),
  };
}

export async function fetchActiveRun(): Promise<ActiveRunSnapshot> {
  const payload = await apiRequest<unknown>("runs/active", {
    method: "GET",
    credentials: "include",
  });
  const source = asRecord(payload);

  if (!source) {
    return {
      activeRun: null,
      activeRunId: null,
    };
  }

  const activeRun = asRecord(source.activeRun);
  return {
    activeRun,
    activeRunId: activeRun ? pickFirstString(activeRun, ["runId", "id"]) : null,
  };
}

export async function fetchKeysBalance(): Promise<KeysBalance> {
  const payload = await apiRequest<unknown>("keys/balance", {
    method: "GET",
    credentials: "include",
  });
  const source = asRecord(payload);

  if (!source) {
    return {
      balance: null,
    };
  }

  return {
    balance: pickFirstNumber(source, ["balance"]),
  };
}

export async function createRun(keysAmount: number): Promise<CreateRunResult> {
  const payload = await apiRequest<unknown>("runs/create", {
    method: "POST",
    credentials: "include",
    body: {
      keysAmount,
    },
  });

  const source = asRecord(payload);
  if (!source) {
    return {
      runId: null,
      keysUsed: null,
      gameState: null,
    };
  }

  const nestedRun = asRecord(source.run);
  const gameState = toGameState(source.gameState) ?? toGameState(source);

  return {
    runId:
      pickFirstString(source, ["runId", "id"]) ??
      (nestedRun ? pickFirstString(nestedRun, ["runId", "id"]) : null) ??
      gameState?.runId ??
      null,
    keysUsed:
      pickFirstNumber(source, ["keysUsed"]) ??
      (nestedRun ? pickFirstNumber(nestedRun, ["keysUsed", "keysAmount"]) : null) ??
      gameState?.keysUsed ??
      null,
    gameState,
  };
}

export async function moveRun(params: MoveRunParams): Promise<MoveRunResult> {
  const action =
    params.actionType === "pass"
      ? {
          type: "pass" as const,
        }
      : params.actionType === "attack"
        ? {
            type: "attack" as const,
            direction: params.direction,
            targetEnemyId: params.targetEnemyId,
          }
        : params.actionType === "break"
          ? {
              type: "break" as const,
              direction: params.direction,
              targetId: params.targetId,
            }
          : {
              type: "move" as const,
              direction: params.direction,
              targetX: params.targetX,
              targetY: params.targetY,
            };

  if (action.type !== "pass" && !action.direction) {
    throw new Error(`Missing direction for ${action.type} action`);
  }

  if (action.type === "attack" && !action.targetEnemyId) {
    throw new Error("Missing targetEnemyId for attack action");
  }

  if (action.type === "move" && (typeof action.targetX !== "number" || typeof action.targetY !== "number")) {
    throw new Error("Missing targetX/targetY for move action");
  }

  if (action.type === "break" && !action.targetId) {
    throw new Error("Missing targetId for break action");
  }

  const payload = await apiRequest<unknown>(`runs/${params.runId}/move`, {
    method: "POST",
    credentials: "include",
    body: {
      action,
    },
  });

  const source = asRecord(payload);
  if (!source) {
    return {
      success: false,
      gameState: null,
      events: [],
      isGameOver: false,
    };
  }

  return {
    success: source.success === true,
    gameState: toGameState(source.gameState) ?? toGameState(source),
    events: toRecordArray(source.events),
    isGameOver: source.isGameOver === true,
  };
}

export async function fetchRunState(runId: string): Promise<RunStateSnapshot> {
  const payload = await apiRequest<unknown>(`runs/${runId}`, {
    method: "GET",
    credentials: "include",
  });

  const source = asRecord(payload);
  if (!source) {
    return {
      canResume: false,
      gameState: null,
    };
  }

  return {
    canResume: source.canResume === true,
    gameState: toGameState(source.gameState) ?? toGameState(source),
  };
}

export async function rerollRun(runId: string): Promise<RunRerollResult> {
  const payload = await apiRequest<unknown>(`runs/${runId}/reroll`, {
    method: "POST",
    credentials: "include",
  });

  const source = asRecord(payload);
  if (!source) {
    return {
      success: false,
      upgradeOptions: [],
      treasureCost: null,
      nextRerollCost: null,
      newTreasure: null,
      currentRerollCount: null,
    };
  }

  return {
    success: source.success === true,
    upgradeOptions: toStringArray(source.upgradeOptions),
    treasureCost: pickFirstNumber(source, ["treasureCost"]),
    nextRerollCost: pickFirstNumber(source, ["nextRerollCost", "rerollCost", "nextUpgradeRerollCost"]),
    newTreasure: pickFirstNumber(source, ["newTreasure"]),
    currentRerollCount: pickFirstNumber(source, ["currentRerollCount"]),
  };
}

export async function selectUpgrade(params: SelectUpgradeParams): Promise<MoveRunResult> {
  const payload = await apiRequest<unknown>(`runs/${params.runId}/move`, {
    method: "POST",
    credentials: "include",
    body: {
      action: {
        type: "upgrade_selected",
        upgradeId: params.upgradeId,
      },
    },
  });

  const source = asRecord(payload);
  if (!source) {
    return {
      success: false,
      gameState: null,
      events: [],
      isGameOver: false,
    };
  }

  return {
    success: source.success === true,
    gameState: toGameState(source.gameState) ?? toGameState(source),
    events: toRecordArray(source.events),
    isGameOver: source.isGameOver === true,
  };
}
