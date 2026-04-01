import type { EnemySnapshot } from "./game.types";
import { isGhostEnemy } from "./game-map";

export type EntityBadgePosition = "nw" | "ne" | "sw" | "se";
export type EntityBadgeTone =
  | "neutral"
  | "danger"
  | "warning"
  | "skull"
  | "ghost"
  | "value"
  | "energy"
  | "treasure"
  | "marble"
  | "jackpot";

export interface EntityCornerBadge {
  position: EntityBadgePosition;
  text: string;
  tone: EntityBadgeTone;
}

export interface EnemyVisualDefinition {
  accent: string;
  label: string;
  token: string;
  isGhost: boolean;
  isSkull: boolean;
  isJackpot: boolean;
  badges: EntityCornerBadge[];
}

export function isSkullEnemySprite(spriteType: string | null) {
  if (!spriteType) return false;
  const normalized = spriteType.trim().toLowerCase();
  return normalized.includes("skeleton") || normalized.includes("skull");
}

export function resolveEnemyVisual(
  enemy: EnemySnapshot,
  options?: { intentArrow?: string | null },
): EnemyVisualDefinition {
  const isGhost = isGhostEnemy(enemy);
  const isSkull = isSkullEnemySprite(enemy.spriteType);
  const isJackpot = enemy.type === "fleeing" || enemy.spriteType?.trim().toLowerCase() === "skeletonking";
  const badges: EntityCornerBadge[] = [];

  if (enemy.hp !== null) {
    badges.push({
      position: "nw",
      text: String(enemy.hp),
      tone: "neutral",
    });
  }

  if (isJackpot) {
    badges.push({
      position: "ne",
      text: "JP",
      tone: "jackpot",
    });
  } else if (isSkull) {
    badges.push({
      position: "ne",
      text: "SK",
      tone: "skull",
    });
  }

  if (options?.intentArrow) {
    badges.push({
      position: "sw",
      text: options.intentArrow,
      tone: "ghost",
    });
  }

  if (enemy.damage !== null) {
    badges.push({
      position: "se",
      text: String(enemy.damage),
      tone: enemy.damage > 0 ? "danger" : "ghost",
    });
  }

  return {
    accent: isJackpot
      ? "enemy-jackpot"
      : isGhost
        ? enemy.damage !== null && enemy.damage > 0
          ? "ghost-danger"
          : "ghost"
        : isSkull
          ? "enemy-skull"
          : "enemy",
    label: isJackpot ? "Jackpot" : isGhost ? "Ghost" : enemy.type,
    token: isJackpot ? "♦" : isGhost ? "G" : "!",
    isGhost,
    isSkull,
    isJackpot,
    badges,
  };
}
