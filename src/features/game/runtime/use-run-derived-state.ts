import { useMemo } from "react";

import { buildAsciiMap, isAttackableEnemy } from "../game-map";
import { getRunModeRewardValue } from "../game-modes";
import {
  countFogMask,
  countTileKinds,
  estimateNextRerollCost,
} from "./game-runtime.utils";
import type { GameStateSnapshot } from "../game.types";

const emptyDerivedState = {
  mapLines: [] as string[],
  enemyLines: [] as string[],
  interactiveLines: [] as string[],
  torchLines: [] as string[],
  portalLines: [] as string[],
  pickupLines: [] as string[],
  trapLines: [] as string[],
  arrowTrapLines: [] as string[],
  mapHeight: 0,
  mapWidth: 0,
  totalCells: 0,
  tileCounts: { wall: 0, hardWall: 0, corridor: 0, unknown: 0, void: 0 },
  fogCounts: { hidden: 0, explored: 0, visible: 0 },
  player: null,
  pendingUpgradeOptions: [] as string[],
  hasPendingUpgradeSelection: false,
  nextRerollCost: null as number | null,
  canEstimateNextRerollCost: false,
  hasEnoughTreasureForReroll: false,
  skDefeatedText: "-",
};

export function useRunDerivedState(gameState: GameStateSnapshot | null, enabled = true) {
  const mapLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return buildAsciiMap(gameState);
  }, [enabled, gameState]);

  const enemyLines = useMemo(() => {
    const player = gameState?.player;
    if (!enabled || !gameState || !player) return [];

    return gameState.enemies.map((enemy, index) => {
      const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      const hp =
        enemy.hp !== null && enemy.maxHp !== null ? `${enemy.hp}/${enemy.maxHp}` : enemy.hp ?? enemy.maxHp ?? "-";
      const attackable = isAttackableEnemy(enemy) ? "yes" : "no";
      const patternDirection = enemy.patternDirection ?? "-";
      const patternMovingPositive =
        enemy.patternMovingPositive === null ? "-" : enemy.patternMovingPositive ? "positive" : "negative";
      const passThroughWalls =
        enemy.canPassThroughWalls === null ? "-" : enemy.canPassThroughWalls ? "yes" : "no";

      return `${index + 1}. ${enemy.id ?? "enemy"} @(${enemy.x},${enemy.y}) dist=${distance} hp=${hp} dmg=${
        enemy.damage ?? "-"
      } type=${enemy.type} sprite=${enemy.spriteType ?? "-"} cooldown=${enemy.moveCooldown ?? "-"} heavy=${
        enemy.hasHeavyHit ? "yes" : "no"
      } charging=${enemy.isChargingHeavy ? "yes" : "no"} attackable=${attackable} patternDir=${patternDirection} patternSign=${patternMovingPositive} passWalls=${passThroughWalls}`;
    });
  }, [enabled, gameState]);

  const interactiveLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.interactive.map(
      (entity, index) => `${index + 1}. ${entity.id ?? entity.type} [${entity.type}] @(${entity.x},${entity.y})`,
    );
  }, [enabled, gameState]);

  const torchLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.torches.map(
      (torch, index) =>
        `${index + 1}. ${torch.id ?? "torch"} @(${torch.x},${torch.y}) revealed=${torch.isRevealed ?? "-"}`,
    );
  }, [enabled, gameState]);

  const portalLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.portals.map(
      (portal, index) => `${index + 1}. ${portal.id ?? "portal"} @(${portal.x},${portal.y})`,
    );
  }, [enabled, gameState]);

  const pickupLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.pickups.map(
      (pickup, index) => `${index + 1}. ${pickup.id ?? pickup.type} [${pickup.type}] @(${pickup.x},${pickup.y})`,
    );
  }, [enabled, gameState]);

  const trapLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.traps.map(
      (trap, index) =>
        `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] @(${trap.x},${trap.y}) dmg=${trap.damage ?? "-"} revealed=${
          trap.isRevealed ?? "-"
        }`,
    );
  }, [enabled, gameState]);

  const arrowTrapLines = useMemo(() => {
    if (!enabled || !gameState) return [];
    return gameState.arrowTraps.map(
      (trap, index) =>
        `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] trigger=(${trap.triggerX},${trap.triggerY}) tombstone=(${trap.tombstoneX},${
          trap.tombstoneY
        }) dmg=${trap.damage ?? "-"} armed=${trap.isArmed ?? "-"} revealed=${trap.isRevealed ?? "-"}`,
    );
  }, [enabled, gameState]);

  const mapHeight = enabled ? gameState?.mapData?.length ?? 0 : 0;
  const mapWidth = enabled ? gameState?.mapData?.[0]?.length ?? 0 : 0;
  const totalCells = mapWidth * mapHeight;
  const tileCounts = enabled ? countTileKinds(gameState?.mapData ?? null) : emptyDerivedState.tileCounts;
  const fogCounts = enabled ? countFogMask(gameState?.fogMask ?? null) : emptyDerivedState.fogCounts;
  const player = gameState?.player ?? null;
  const pendingUpgradeOptions = gameState?.pendingUpgradeOptions ?? [];
  const hasPendingUpgradeSelection = pendingUpgradeOptions.length > 0;
  const nextRerollCost =
    typeof gameState?.nextRerollCost === "number" && gameState.nextRerollCost >= 0
      ? gameState.nextRerollCost
      : estimateNextRerollCost(gameState?.runType ?? "NORMAL", gameState?.currentRerollCount);
  const canEstimateNextRerollCost = typeof nextRerollCost === "number";
  const playerTreasure = getRunModeRewardValue(gameState?.runType ?? "NORMAL", player);
  const hasEnoughTreasureForReroll =
    canEstimateNextRerollCost && typeof playerTreasure === "number" && playerTreasure >= nextRerollCost;
  const skDefeatedText =
    gameState?.skDefeated === null || gameState?.skDefeated === undefined ? "-" : String(gameState.skDefeated);

  return {
    mapLines,
    enemyLines,
    interactiveLines,
    torchLines,
    portalLines,
    pickupLines,
    trapLines,
    arrowTrapLines,
    mapHeight,
    mapWidth,
    totalCells,
    tileCounts,
    fogCounts,
    player,
    pendingUpgradeOptions,
    hasPendingUpgradeSelection,
    nextRerollCost,
    canEstimateNextRerollCost,
    hasEnoughTreasureForReroll,
    skDefeatedText,
  };
}
