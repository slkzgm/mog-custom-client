import { useMemo } from "react";

import { buildAsciiMap, isAttackableEnemy } from "../game-map";
import {
  countFogMask,
  countTileKinds,
  estimateNextRerollCost,
} from "./game-runtime.utils";
import type { GameStateSnapshot } from "../game.types";

export function useRunDerivedState(gameState: GameStateSnapshot | null) {
  const mapLines = useMemo(() => {
    if (!gameState) return [];
    return buildAsciiMap(gameState);
  }, [gameState]);

  const enemyLines = useMemo(() => {
    const player = gameState?.player;
    if (!gameState || !player) return [];

    return gameState.enemies.map((enemy, index) => {
      const distance = Math.abs(enemy.x - player.x) + Math.abs(enemy.y - player.y);
      const hp =
        enemy.hp !== null && enemy.maxHp !== null ? `${enemy.hp}/${enemy.maxHp}` : enemy.hp ?? enemy.maxHp ?? "-";
      const attackable = isAttackableEnemy(enemy) ? "yes" : "no";

      return `${index + 1}. ${enemy.id ?? "enemy"} @(${enemy.x},${enemy.y}) dist=${distance} hp=${hp} dmg=${
        enemy.damage ?? "-"
      } type=${enemy.type} sprite=${enemy.spriteType ?? "-"} cooldown=${enemy.moveCooldown ?? "-"} heavy=${
        enemy.hasHeavyHit ? "yes" : "no"
      } charging=${enemy.isChargingHeavy ? "yes" : "no"} attackable=${attackable}`;
    });
  }, [gameState]);

  const interactiveLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.interactive.map(
      (entity, index) => `${index + 1}. ${entity.id ?? entity.type} [${entity.type}] @(${entity.x},${entity.y})`,
    );
  }, [gameState]);

  const torchLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.torches.map(
      (torch, index) =>
        `${index + 1}. ${torch.id ?? "torch"} @(${torch.x},${torch.y}) revealed=${torch.isRevealed ?? "-"}`,
    );
  }, [gameState]);

  const portalLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.portals.map(
      (portal, index) => `${index + 1}. ${portal.id ?? "portal"} @(${portal.x},${portal.y})`,
    );
  }, [gameState]);

  const pickupLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.pickups.map(
      (pickup, index) => `${index + 1}. ${pickup.id ?? pickup.type} [${pickup.type}] @(${pickup.x},${pickup.y})`,
    );
  }, [gameState]);

  const trapLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.traps.map(
      (trap, index) => `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] @(${trap.x},${trap.y})`,
    );
  }, [gameState]);

  const arrowTrapLines = useMemo(() => {
    if (!gameState) return [];
    return gameState.arrowTraps.map(
      (trap, index) => `${index + 1}. ${trap.id ?? trap.type} [${trap.type}] @(${trap.x},${trap.y})`,
    );
  }, [gameState]);

  const mapHeight = gameState?.mapData?.length ?? 0;
  const mapWidth = gameState?.mapData?.[0]?.length ?? 0;
  const totalCells = mapWidth * mapHeight;
  const tileCounts = countTileKinds(gameState?.mapData ?? null);
  const fogCounts = countFogMask(gameState?.fogMask ?? null);
  const player = gameState?.player ?? null;
  const pendingUpgradeOptions = gameState?.pendingUpgradeOptions ?? [];
  const hasPendingUpgradeSelection = pendingUpgradeOptions.length > 0;
  const nextRerollCost =
    typeof gameState?.nextRerollCost === "number" && gameState.nextRerollCost >= 0
      ? gameState.nextRerollCost
      : estimateNextRerollCost(gameState?.currentRerollCount);
  const canEstimateNextRerollCost = typeof nextRerollCost === "number";
  const playerTreasure = player?.treasure ?? null;
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
