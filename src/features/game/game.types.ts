export type RunType = "NORMAL" | "WORLD";
export type BalanceResource = "keys" | "world-keys" | "amber";

export interface GameStatus {
  paused: boolean;
  timestamp: number | null;
}

export interface ActiveRunSnapshot {
  activeRun: Record<string, unknown> | null;
  activeRunId: string | null;
  runType: RunType | null;
}

export interface KeysBalance {
  balance: number | null;
  resource: BalanceResource;
}

export interface ClaimsWeekSnapshot {
  weekNumber: number | null;
  userTreasure: number | null;
  userMarbles: number | null;
  totalTreasure: number | null;
}

export interface ClaimsSnapshot {
  currentWeek: ClaimsWeekSnapshot | null;
  totalClaimable: string | null;
  claimsLocked: boolean;
}

export type MoveDirection = "up" | "down" | "left" | "right";
export type RunActionType = "move" | "attack" | "break" | "pass";

export interface GamePlayerSnapshot {
  x: number;
  y: number;
  energy: number | null;
  maxEnergy: number | null;
  treasure: number | null;
  marbles: number | null;
  amber: number | null;
  raffleTickets: number | null;
  hongbao: number | null;
  abs: number | null;
  baseAttackPower: number | null;
  attackPower: number | null;
  totalEnergySpent: number | null;
  totalEnemiesKilled: number | null;
  upgrades: string[];
  activeBuffs: GameBuffSnapshot[];
  buffsRaw: Record<string, unknown>;
}

export interface MapEntitySnapshot {
  x: number;
  y: number;
  type: string;
  id: string | null;
  linkedPortalId?: string | null;
  value: number | null;
  damage: number | null;
  tileIndex: number | null;
}

export interface TrapSnapshot extends MapEntitySnapshot {
  isRevealed: boolean | null;
}

export interface ArrowTrapSnapshot extends MapEntitySnapshot {
  triggerX: number;
  triggerY: number;
  tombstoneX: number;
  tombstoneY: number;
  isArmed: boolean | null;
  isRevealed: boolean | null;
}

export interface GameBuffSnapshot {
  key: string;
  value: string | number | boolean;
}

export interface EnemySnapshot extends MapEntitySnapshot {
  hp: number | null;
  maxHp: number | null;
  damage: number | null;
  spriteType: string | null;
  moveCooldown: number | null;
  hasHeavyHit: boolean;
  isChargingHeavy: boolean;
  patternDirection: string | null;
  patternMovingPositive: boolean | null;
  canPassThroughWalls: boolean | null;
}

export interface TorchSnapshot extends MapEntitySnapshot {
  isRevealed: boolean | null;
}

export interface GameStateSnapshot {
  runId: string | null;
  runType: RunType | null;
  userId: string | null;
  status: string | null;
  keysUsed: number | null;
  currentFloor: number | null;
  turnNumber: number | null;
  timePlayed: number | null;
  createdAt: string | null;
  lastActionAt: string | null;
  currentRerollCount: number | null;
  nextRerollCost: number | null;
  teleportUseCount: number | null;
  skDefeated: boolean | null;
  collectedJackpot:
    | {
        tier: string;
        payoutWei?: string | null;
      }
    | null;
  pendingUpgradeCount: number | null;
  pendingUpgradeOptions: string[];
  upgradesPerFloor: Record<string, string>;
  player: GamePlayerSnapshot | null;
  mapData: number[][] | null;
  tileData: number[][] | null;
  fogMask: number[][] | null;
  enemies: EnemySnapshot[];
  interactive: MapEntitySnapshot[];
  torches: TorchSnapshot[];
  portals: MapEntitySnapshot[];
  pickups: MapEntitySnapshot[];
  traps: TrapSnapshot[];
  arrowTraps: ArrowTrapSnapshot[];
  raw: Record<string, unknown>;
}

export interface CreateRunResult {
  runId: string | null;
  runType: RunType | null;
  keysUsed: number | null;
  gameState: GameStateSnapshot | null;
}

export interface MoveRunParams {
  runId: string;
  direction?: MoveDirection;
  actionType: RunActionType;
  targetX?: number;
  targetY?: number;
  targetEnemyId?: string;
  targetId?: string;
}

export interface MoveRunResult {
  success: boolean;
  gameState: GameStateSnapshot | null;
  events: Record<string, unknown>[];
  isGameOver: boolean;
}

export interface TeleportRunResult extends MoveRunResult {
  treasureCost: number | null;
  newTreasure: number | null;
  teleportUseCount: number | null;
}

export interface RunStateSnapshot {
  canResume: boolean;
  gameState: GameStateSnapshot | null;
}

export interface RunRerollResult {
  success: boolean;
  upgradeOptions: string[];
  treasureCost: number | null;
  nextRerollCost: number | null;
  newTreasure: number | null;
  currentRerollCount: number | null;
}

export interface SelectUpgradeParams {
  runId: string;
  upgradeId: string;
}
