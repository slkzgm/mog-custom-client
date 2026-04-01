import type { MoveDirection } from "../game.types";

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
