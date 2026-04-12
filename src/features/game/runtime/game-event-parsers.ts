import type { MoveDirection } from "../game.types";
import type { GameStateSnapshot } from "../game.types";

export interface PortalPromptEvent {
  portalId: string;
  linkedPortalId: string | null;
  portalX: number;
  portalY: number;
  destinationX: number;
  destinationY: number;
  teleportCost: number | null;
  playerTreasure: number | null;
}

export interface ShroomTargetTile {
  x: number;
  y: number;
  isMaxRange: boolean;
}

export interface ShroomChargingEvent {
  enemyId: string;
  direction: MoveDirection;
  shroomX: number;
  shroomY: number;
  targetTiles: ShroomTargetTile[];
}

export interface JackalotKillEvent {
  rewardType: string;
  rewardValue: number | null;
}

export interface JackpotPickupEvent {
  tier: string;
  payoutWei: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isMoveDirection(value: unknown): value is MoveDirection {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

export function parseLatestPortalPromptEvent(events: Record<string, unknown>[]) {
  let latest: PortalPromptEvent | null = null;

  for (const event of events) {
    const source = asRecord(event);
    if (!source || source.type !== "portal_prompt") continue;

    const portalId = typeof source.portalId === "string" ? source.portalId : null;
    const linkedPortalId = typeof source.linkedPortalId === "string" ? source.linkedPortalId : null;
    const portalX = typeof source.portalX === "number" ? source.portalX : null;
    const portalY = typeof source.portalY === "number" ? source.portalY : null;
    const destinationX = typeof source.destinationX === "number" ? source.destinationX : null;
    const destinationY = typeof source.destinationY === "number" ? source.destinationY : null;
    const teleportCost = typeof source.teleportCost === "number" ? source.teleportCost : null;
    const playerTreasure = typeof source.playerTreasure === "number" ? source.playerTreasure : null;

    if (!portalId || portalX === null || portalY === null || destinationX === null || destinationY === null) continue;

    latest = {
      portalId,
      linkedPortalId,
      portalX,
      portalY,
      destinationX,
      destinationY,
      teleportCost,
      playerTreasure,
    };
  }

  return latest;
}

export function parseShroomChargingEvents(events: Record<string, unknown>[]) {
  const parsed: ShroomChargingEvent[] = [];

  for (const event of events) {
    const source = asRecord(event);
    if (!source || source.type !== "shroom_charging") continue;

    const enemyId = typeof source.enemyId === "string" ? source.enemyId : null;
    const shroomX = typeof source.shroomX === "number" ? source.shroomX : null;
    const shroomY = typeof source.shroomY === "number" ? source.shroomY : null;
    const direction = isMoveDirection(source.direction) ? source.direction : null;
    const rawTiles = Array.isArray(source.targetTiles) ? source.targetTiles : [];

    if (!enemyId || shroomX === null || shroomY === null || !direction) continue;

    const targetTiles: ShroomTargetTile[] = rawTiles
      .map((item) => {
        const tile = asRecord(item);
        if (!tile) return null;

        const x = typeof tile.x === "number" ? tile.x : null;
        const y = typeof tile.y === "number" ? tile.y : null;
        if (x === null || y === null) return null;

        return {
          x,
          y,
          isMaxRange: tile.isMaxRange === true,
        };
      })
      .filter((item): item is ShroomTargetTile => Boolean(item));

    parsed.push({
      enemyId,
      direction,
      shroomX,
      shroomY,
      targetTiles,
    });
  }

  return parsed;
}

export function parseLatestJackalotKillEvent(events: Record<string, unknown>[]) {
  let enemyKilledSource: Record<string, unknown> | null = null;
  let sawSkeletonKingDefeated = false;

  for (const event of events) {
    const source = asRecord(event);
    if (!source) continue;

    if (source.type === "enemy_killed") {
      enemyKilledSource = source;
      continue;
    }

    if (source.type === "skeleton_king_defeated") {
      sawSkeletonKingDefeated = true;
    }
  }

  if (!sawSkeletonKingDefeated || !enemyKilledSource) return null;

  const lootDropped = asRecord(enemyKilledSource.lootDropped);
  const rewardType = lootDropped ? (typeof lootDropped.type === "string" ? lootDropped.type : "unknown") : "unknown";
  const rewardValue = lootDropped && typeof lootDropped.value === "number" ? lootDropped.value : null;

  return {
    rewardType,
    rewardValue,
  } satisfies JackalotKillEvent;
}

export function parseLatestJackpotPickupEvent(
  events: Record<string, unknown>[],
  gameState: GameStateSnapshot | null,
) {
  if (!gameState?.collectedJackpot?.tier) return null;

  let sawJackpotPickup = false;
  for (const event of events) {
    const source = asRecord(event);
    if (!source || source.type !== "pickup_collected") continue;

    const pickupType = typeof source.pickupType === "string" ? source.pickupType : null;
    if (pickupType === "jackpot_minor" || pickupType === "jackpot_major" || pickupType === "jackpot_mega") {
      sawJackpotPickup = true;
    }
  }

  if (!sawJackpotPickup) return null;

  return {
    tier: gameState.collectedJackpot.tier,
    payoutWei: gameState.collectedJackpot.payoutWei ?? null,
  } satisfies JackpotPickupEvent;
}
