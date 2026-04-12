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

function normalizeEnemyValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeEnemySpriteType(spriteType: string | null) {
  const normalized = normalizeEnemyValue(spriteType);
  if (!normalized) return "";
  if (normalized.endsWith("_world")) return normalized.slice(0, -6);
  return normalized;
}

export function resolveEnemyDisplayName(enemy: Pick<EnemySnapshot, "type" | "spriteType">) {
  const spriteType = normalizeEnemySpriteType(enemy.spriteType);

  switch (spriteType) {
    case "slime":
      return "Slime";
    case "redslime":
      return "Red Slime";
    case "bat":
      return "Bat";
    case "skeleton":
      return "Skeleton";
    case "skeleton2":
      return "Skeleton II";
    case "skeletonking":
      return "Sir Jackalot";
    case "skullbat":
      return "Skull Bat";
    case "mimic":
      return "Mimic";
    case "ghost":
      return "Ghost";
    case "ghost2":
      return "Ghost II";
    case "shroom":
      return "Shroom";
    case "kingslime":
      return "King Slime";
    case "maomi":
      return "Lucky Nian";
    case "pengu":
      return "Pengu";
    default: {
      const type = normalizeEnemyValue(enemy.type);
      if (!type) return "Enemy";
      return type;
    }
  }
}

function resolvePatternToken(patternDirection: string | null) {
  const direction = normalizeEnemyValue(patternDirection);
  if (direction === "horizontal") return "↔";
  if (direction === "vertical") return "↕";
  return "⇄";
}

function resolveEnemyToken(enemy: EnemySnapshot, isGhost: boolean, isJackpot: boolean) {
  const spriteType = normalizeEnemySpriteType(enemy.spriteType);

  if (isJackpot) {
    return spriteType === "skeletonking" ? "♔" : "♦";
  }

  if (spriteType === "mimic") return "M";
  if (spriteType === "shroom") return "T";
  if (spriteType === "kingslime") return "K";
  if (spriteType === "pengu") return "P";
  if (spriteType === "maomi") return "N";

  switch (normalizeEnemyValue(enemy.type)) {
    case "pattern":
      return resolvePatternToken(enemy.patternDirection);
    case "erratic":
      return "✦";
    case "chaser":
      return "◎";
    case "stationary":
      return "✳";
    case "wobble":
      return "W";
    default:
      return isGhost ? "G" : "!";
  }
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
    label: isJackpot ? "Sir Jackalot" : resolveEnemyDisplayName(enemy),
    token: resolveEnemyToken(enemy, isGhost, isJackpot),
    isGhost,
    isSkull,
    isJackpot,
    badges,
  };
}
