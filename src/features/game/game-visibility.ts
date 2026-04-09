import type { GameBuffSnapshot, GameStateSnapshot } from "./game.types";

function matrixAt(matrix: number[][] | null, x: number, y: number): number | null {
  if (!matrix) return null;
  const row = matrix[y];
  if (!row) return null;
  const value = row[x];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function isTruthyScoutBuff(buff: GameBuffSnapshot) {
  if (buff.key !== "hasScout") return false;
  return buff.value === true || buff.value === 1 || buff.value === "true";
}

export function hasScoutReveal(gameState: Pick<GameStateSnapshot, "player"> | null | undefined) {
  if (!gameState?.player) return false;
  if (gameState.player.buffsRaw?.hasScout === true) return true;
  return gameState.player.activeBuffs.some(isTruthyScoutBuff);
}

export function effectiveFogValueAt(gameState: GameStateSnapshot, x: number, y: number): number | null {
  const fogValue = matrixAt(gameState.fogMask, x, y);
  if (!hasScoutReveal(gameState)) return fogValue;

  const tileValue = matrixAt(gameState.mapData, x, y);
  if (tileValue === null) return fogValue;
  return Math.max(fogValue ?? 0, 2);
}

export function isEffectivelyVisible(gameState: GameStateSnapshot, x: number, y: number) {
  const fogValue = effectiveFogValueAt(gameState, x, y);
  return typeof fogValue === "number" && fogValue >= 2;
}
