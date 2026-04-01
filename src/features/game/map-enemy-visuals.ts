import type { EnemySnapshot } from "./game.types";
import { isGhostEnemy } from "./game-map";

export type EntityBadgePosition = "nw" | "ne" | "sw" | "se";
export type EntityBadgeTone = "neutral" | "danger" | "warning" | "skull" | "ghost" | "value";

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
  const badges: EntityCornerBadge[] = [];

  if (enemy.hp !== null) {
    badges.push({
      position: "nw",
      text: String(enemy.hp),
      tone: "neutral",
    });
  }

  if (isSkull) {
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
    accent: isGhost ? (enemy.damage !== null && enemy.damage > 0 ? "ghost-danger" : "ghost") : isSkull ? "enemy-skull" : "enemy",
    label: isGhost ? "Ghost" : enemy.type,
    token: isGhost ? "G" : "!",
    isGhost,
    isSkull,
    badges,
  };
}
