import type { GamePlayerSnapshot } from "./game.types";
import type { BalanceResource, RunType } from "./game.types";

export interface RunModeDefinition {
  runType: RunType;
  label: string;
  description: string;
  keyResource: BalanceResource;
  rewardLabel: string;
  accent: "gold" | "ember";
}

export const runModeDefinitions: Record<RunType, RunModeDefinition> = {
  NORMAL: {
    runType: "NORMAL",
    label: "Normal Mode",
    description: "Classic arcade progression. Spend keys to enter a run and collect treasures through the dungeon.",
    keyResource: "keys",
    rewardLabel: "Treasures",
    accent: "gold",
  },
  WORLD: {
    runType: "WORLD",
    label: "World's Eve",
    description: "Parallel world progression. Spend world keys to enter and collect amber instead of classic treasures.",
    keyResource: "world-keys",
    rewardLabel: "Amber",
    accent: "ember",
  },
};

export const runModeOrder: RunType[] = ["NORMAL", "WORLD"];

export function getRunModeDefinition(runType: RunType) {
  return runModeDefinitions[runType];
}

export function getRunModeRewardKey(runType: RunType) {
  return runType === "WORLD" ? "amber" : "treasure";
}

export function getRunModeRewardValue(runType: RunType, player: GamePlayerSnapshot | null | undefined) {
  if (!player) return null;
  return player[getRunModeRewardKey(runType)];
}
