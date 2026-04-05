import type { GamePlayerSnapshot, GameStateSnapshot } from "./game.types";
import { getUpgradeCatalogEntry } from "./upgrade-catalog";

export type UpgradeRarity = "common" | "rare" | "epic";

export interface MogVerifiedUpgradeCatalogEntry {
  serverId: string;
  uiKey: string;
  name: string;
  descriptionTemplate: string;
  tooltipTemplate: string | null;
  worldDescriptionTemplate: string | null;
  rarity: UpgradeRarity;
  effectType: string;
  effectValue: number;
  minFloor: number;
  maxFloor: number | null;
  modalParams: Record<string, number>;
  runtimeTooltipParamStateKeys: Record<string, string>;
  runtimeActiveStateKeys: string[];
  runtimeFloorDurationStateKey: string | null;
}

export const MOG_VERIFIED_UPGRADE_CATALOG_VERSION = "2026-04-04";

export const MOG_VERIFIED_UPGRADE_CATALOG_SOURCES = {
  idToUiKey: "/tmp/mogchunks/dyn/47e060b964eb99af.js",
  upgradeMessages: "/tmp/mogchunks/dyn/ace22f6cc6216db7.js",
  tooltipMessages: "/tmp/mogchunks/dyn/a10515675d3184e9.js",
} as const;

export const MOG_VERIFIED_UPGRADES_NOT_IN_STATIC_POOL = [
  {
    serverId: "second_wind",
    uiKey: "secondWind",
    reason:
      "Present in official i18n and runtime player state, but absent from the live static upgrade pool table in 47e060b964eb99af.js.",
  },
  {
    serverId: "force_palm",
    uiKey: "forcePalm",
    reason:
      "Present in official i18n and runtime player state (`hasPush`), but absent from the live static upgrade pool table in 47e060b964eb99af.js.",
  },
] as const;

export const MOG_VERIFIED_UPGRADE_CATALOG: readonly MogVerifiedUpgradeCatalogEntry[] = [
  {
    serverId: "heal_small",
    uiKey: "energySurge",
    name: "Energy Surge",
    descriptionTemplate: "Restore {amount} energy",
    tooltipTemplate: null,
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "heal",
    effectValue: 15,
    minFloor: 1,
    maxFloor: null,
    modalParams: { amount: 15 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "heal_large",
    uiKey: "energyWave",
    name: "Energy Wave",
    descriptionTemplate: "Restore {amount} energy",
    tooltipTemplate: null,
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "heal",
    effectValue: 25,
    minFloor: 1,
    maxFloor: null,
    modalParams: { amount: 25 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "max_energy_small",
    uiKey: "vigor1",
    name: "Vigor I",
    descriptionTemplate: "+{amount} max energy",
    tooltipTemplate: null,
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "maxEnergy",
    effectValue: 15,
    minFloor: 1,
    maxFloor: null,
    modalParams: { amount: 15 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "vision_boost",
    uiKey: "eagleEye",
    name: "Eagle Eye",
    descriptionTemplate: "+{radius} vision",
    tooltipTemplate: "Extended vision (+{radius} radius)",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "visionBoost",
    effectValue: 2,
    minFloor: 1,
    maxFloor: null,
    modalParams: { radius: 2 },
    runtimeTooltipParamStateKeys: { radius: "visionBoost" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "vision_boost",
  },
  {
    serverId: "magnet",
    uiKey: "magneticPull",
    name: "Magnetic Pull",
    descriptionTemplate: "Auto pickup within {radius} tiles",
    tooltipTemplate: "Auto-collect pickups within {radius} tiles",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "magnet",
    effectValue: 2,
    minFloor: 1,
    maxFloor: null,
    modalParams: { radius: 2 },
    runtimeTooltipParamStateKeys: { radius: "magnetRange" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "magnet",
  },
  {
    serverId: "scout",
    uiKey: "scout",
    name: "Scout",
    descriptionTemplate: "Reveal map",
    tooltipTemplate: "Entire map revealed",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "scout",
    effectValue: 1,
    minFloor: 1,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasScout"],
    runtimeFloorDurationStateKey: "scout",
  },
  {
    serverId: "sprint",
    uiKey: "sprint",
    name: "Sprint",
    descriptionTemplate: "{moves} free moves",
    tooltipTemplate: "Next {moves} moves cost no energy",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "sprint",
    effectValue: 10,
    minFloor: 1,
    maxFloor: null,
    modalParams: { moves: 10 },
    runtimeTooltipParamStateKeys: { moves: "sprintMoves" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "patch_up",
    uiKey: "patchUp",
    name: "Patch Up",
    descriptionTemplate: "Restore {amount} energy",
    tooltipTemplate: null,
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "patchUp",
    effectValue: 10,
    minFloor: 1,
    maxFloor: null,
    modalParams: { amount: 10 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "tough_hide",
    uiKey: "toughHide",
    name: "Tough Hide",
    descriptionTemplate: "Block {hits} hits",
    tooltipTemplate: "Block the next {hits} hit(s) completely",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "toughHide",
    effectValue: 2,
    minFloor: 1,
    maxFloor: null,
    modalParams: { hits: 2 },
    runtimeTooltipParamStateKeys: { hits: "toughHideHits" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "tough_hide",
  },
  {
    serverId: "quick_step",
    uiKey: "quickStep",
    name: "Quick Step",
    descriptionTemplate: "{moves} free moves",
    tooltipTemplate: "Next {moves} moves cost no energy",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "quickStep",
    effectValue: 5,
    minFloor: 1,
    maxFloor: null,
    modalParams: { moves: 5 },
    runtimeTooltipParamStateKeys: { moves: "quickStepMoves" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "quick_step",
  },
  {
    serverId: "mimic_sense",
    uiKey: "mimicSense",
    name: "Mimic Sense",
    descriptionTemplate: "Reveal hidden mimics",
    tooltipTemplate: "Mimics revealed as enemies",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "mimicSense",
    effectValue: 1,
    minFloor: 1,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasMimicSense"],
    runtimeFloorDurationStateKey: "mimic_sense",
  },
  {
    serverId: "treasure_bonus",
    uiKey: "goldenTouch",
    name: "Golden Touch",
    descriptionTemplate: "+{percent}% treasure",
    tooltipTemplate: "+{percent}% treasure value",
    worldDescriptionTemplate: "+{percent}% worldseeds",
    rarity: "rare",
    effectType: "treasureBonus",
    effectValue: 50,
    minFloor: 3,
    maxFloor: null,
    modalParams: { percent: 50 },
    runtimeTooltipParamStateKeys: { percent: "treasureBonus" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "treasure_bonus",
  },
  {
    serverId: "lucky_find",
    uiKey: "luckyFind",
    name: "Lucky Find",
    descriptionTemplate: "Better loot drops",
    tooltipTemplate: "+{percent}% better loot drops",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "luckyFind",
    effectValue: 20,
    minFloor: 3,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: { percent: "luckyFindBonus" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "lucky_find",
  },
  {
    serverId: "thorns",
    uiKey: "thorns",
    name: "Thorns",
    descriptionTemplate: "Reflect 2 damage, {turns} charges",
    tooltipTemplate: "Reflect 2 damage, {turns} charges",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "thorns",
    effectValue: 5,
    minFloor: 5,
    maxFloor: null,
    modalParams: { turns: 5 },
    runtimeTooltipParamStateKeys: { turns: "thornsTurns" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "thorns",
  },
  {
    serverId: "max_energy_large",
    uiKey: "vigor2",
    name: "Vigor II",
    descriptionTemplate: "+{amount} max energy",
    tooltipTemplate: null,
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "maxEnergy",
    effectValue: 30,
    minFloor: 3,
    maxFloor: null,
    modalParams: { amount: 30 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "swift_steps",
    uiKey: "lightFeet",
    name: "Light Feet",
    descriptionTemplate: "Free movement for {turns} turns",
    tooltipTemplate: "Movement costs no energy for {turns} turn(s)",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "swiftSteps",
    effectValue: 20,
    minFloor: 3,
    maxFloor: null,
    modalParams: { turns: 20 },
    runtimeTooltipParamStateKeys: { turns: "swiftStepsTurns" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "invisibility",
    uiKey: "shadowCloak",
    name: "Shadow Cloak",
    descriptionTemplate: "{turns} turns invisible, +1 ambush",
    tooltipTemplate: "{turns} turns invisible, +1 ambush damage",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "invisibility",
    effectValue: 20,
    minFloor: 3,
    maxFloor: null,
    modalParams: { turns: 20 },
    runtimeTooltipParamStateKeys: { turns: "invisibilityTurns" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: null,
  },
  {
    serverId: "bone_breaker",
    uiKey: "boneBreaker",
    name: "Bone Breaker",
    descriptionTemplate: "+{damage} damage vs skeletons",
    tooltipTemplate: "+{damage} damage vs skeletons",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "boneBreaker",
    effectValue: 1,
    minFloor: 5,
    maxFloor: null,
    modalParams: { damage: 1 },
    runtimeTooltipParamStateKeys: { damage: "boneBreaker" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "bone_breaker",
  },
  {
    serverId: "momentum",
    uiKey: "momentum",
    name: "Momentum",
    descriptionTemplate: "Gain 1 free move after each kill",
    tooltipTemplate: "Free move after kills",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "momentum",
    effectValue: 1,
    minFloor: 3,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasMomentum"],
    runtimeFloorDurationStateKey: "momentum",
  },
  {
    serverId: "retaliation",
    uiKey: "retaliation",
    name: "Retaliation",
    descriptionTemplate: "Reflect {damage} damage when hit",
    tooltipTemplate: "Reflect 1 damage when hit",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "retaliation",
    effectValue: 1,
    minFloor: 5,
    maxFloor: null,
    modalParams: { damage: 1 },
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasRetaliation"],
    runtimeFloorDurationStateKey: "retaliation",
  },
  {
    serverId: "attack_up",
    uiKey: "sharpBlade",
    name: "Sharp Blade",
    descriptionTemplate: "+{amount} attack",
    tooltipTemplate: "+{attack} attack power",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "attack",
    effectValue: 1,
    minFloor: 5,
    maxFloor: null,
    modalParams: { amount: 1 },
    runtimeTooltipParamStateKeys: { attack: "attackBonus" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "attack_up",
  },
  {
    serverId: "shield",
    uiKey: "barrier",
    name: "Barrier",
    descriptionTemplate: "Block {hits} hits",
    tooltipTemplate: "Block the next {hits} hit(s) completely",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "shield",
    effectValue: 5,
    minFloor: 5,
    maxFloor: null,
    modalParams: { hits: 5 },
    runtimeTooltipParamStateKeys: { hits: "shieldHits" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "shield",
  },
  {
    serverId: "critical_strike",
    uiKey: "critStrike",
    name: "Crit Strike",
    descriptionTemplate: "{percent}% crit chance",
    tooltipTemplate: "{percent}% chance for double damage",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "criticalStrike",
    effectValue: 10,
    minFloor: 5,
    maxFloor: null,
    modalParams: { percent: 10 },
    runtimeTooltipParamStateKeys: { percent: "critChance" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "critical_strike",
  },
  {
    serverId: "cleave",
    uiKey: "cleave",
    name: "Cleave",
    descriptionTemplate: "Hit all adjacent enemies for 25% damage",
    tooltipTemplate: "Attacks hit all adjacent enemies for 25% damage",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "cleave",
    effectValue: 1,
    minFloor: 5,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "cleave",
  },
  {
    serverId: "poison_blade",
    uiKey: "poisonBlade",
    name: "Poison Blade",
    descriptionTemplate: "Poison enemies, {turns} charges",
    tooltipTemplate: "Attacks poison enemies for 3 turns ({turns} charges left)",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "poisonBlade",
    effectValue: 4,
    minFloor: 7,
    maxFloor: null,
    modalParams: { turns: 4 },
    runtimeTooltipParamStateKeys: { turns: "poisonBladeTurns" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "poison_blade",
  },
  {
    serverId: "vampiric",
    uiKey: "lifeSteal",
    name: "Life Steal",
    descriptionTemplate: "+{amount} energy per kill",
    tooltipTemplate: "Heal {amount} energy per kill",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "vampiric",
    effectValue: 1,
    minFloor: 8,
    maxFloor: null,
    modalParams: { amount: 1 },
    runtimeTooltipParamStateKeys: { amount: "vampiricHeal" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "vampiric",
  },
  {
    serverId: "berserker",
    uiKey: "berserker",
    name: "Berserker",
    descriptionTemplate: "+{attack} attack when low energy",
    tooltipTemplate: "+{attack} attack when below 30 energy",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "berserker",
    effectValue: 2,
    minFloor: 8,
    maxFloor: null,
    modalParams: { attack: 2 },
    runtimeTooltipParamStateKeys: { attack: "berserkerBonus" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "berserker",
  },
  {
    serverId: "dodge_roll",
    uiKey: "dodgeRoll",
    name: "Dodge Roll",
    descriptionTemplate: "{percent}% dodge chance",
    tooltipTemplate: "{percent}% chance to avoid attacks",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "dodgeRoll",
    effectValue: 15,
    minFloor: 8,
    maxFloor: null,
    modalParams: { percent: 15 },
    runtimeTooltipParamStateKeys: { percent: "dodgeChance" },
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "dodge_roll",
  },
  {
    serverId: "armor_plating",
    uiKey: "armorPlating",
    name: "Armor Plating",
    descriptionTemplate: "50% chance to reduce damage by 25%",
    tooltipTemplate: "50% chance to reduce damage by 25%",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "armorPlating",
    effectValue: 1,
    minFloor: 8,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "armor_plating",
  },
  {
    serverId: "spirit_ward",
    uiKey: "spiritWard",
    name: "Spirit Ward",
    descriptionTemplate: "Immune to ghost damage, knock back ghosts",
    tooltipTemplate: "Immune to ghost damage, knockback",
    worldDescriptionTemplate: null,
    rarity: "epic",
    effectType: "spiritWard",
    effectValue: 1,
    minFloor: 8,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasSpiritWard"],
    runtimeFloorDurationStateKey: "spirit_ward",
  },
  {
    serverId: "trap_sight",
    uiKey: "trapSight",
    name: "Trap Sight",
    descriptionTemplate: "Reveal all traps in explored areas",
    tooltipTemplate: "Traps revealed in explored areas",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "trapSight",
    effectValue: 1,
    minFloor: 1,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasTrapSight"],
    runtimeFloorDurationStateKey: "trap_sight",
  },
  {
    serverId: "scavenger",
    uiKey: "scavenger",
    name: "Scavenger",
    descriptionTemplate: "Pots and crates always drop loot",
    tooltipTemplate: "Guaranteed loot from destructibles",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "scavenger",
    effectValue: 1,
    minFloor: 1,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasScavenger"],
    runtimeFloorDurationStateKey: "scavenger",
  },
  {
    serverId: "soft_traps",
    uiKey: "softTraps",
    name: "Soft Traps",
    descriptionTemplate: "Halve all trap damage",
    tooltipTemplate: "Trap damage halved",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "softTraps",
    effectValue: 3,
    minFloor: 3,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: [],
    runtimeFloorDurationStateKey: "soft_traps",
  },
  {
    serverId: "treasure_hunter",
    uiKey: "treasureHunter",
    name: "Treasure Hunter",
    descriptionTemplate: "Chests drop 1 extra item",
    tooltipTemplate: "Chests drop extra loot",
    worldDescriptionTemplate: null,
    rarity: "rare",
    effectType: "treasureHunter",
    effectValue: 1,
    minFloor: 3,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasTreasureHunter"],
    runtimeFloorDurationStateKey: "treasure_hunter",
  },
  {
    serverId: "portal_adept",
    uiKey: "portalAdept",
    name: "Portal Adept",
    descriptionTemplate: "First portal free, others half price",
    tooltipTemplate: "1st portal free, others half price",
    worldDescriptionTemplate: null,
    rarity: "common",
    effectType: "portalAdept",
    effectValue: 1,
    minFloor: 3,
    maxFloor: null,
    modalParams: {},
    runtimeTooltipParamStateKeys: {},
    runtimeActiveStateKeys: ["hasPortalAdept"],
    runtimeFloorDurationStateKey: "portal_adept",
  },
] as const;

export type MogVerifiedUpgradeServerId = (typeof MOG_VERIFIED_UPGRADE_CATALOG)[number]["serverId"];

export const MOG_VERIFIED_UPGRADE_CATALOG_BY_SERVER_ID: Readonly<
  Record<MogVerifiedUpgradeServerId, MogVerifiedUpgradeCatalogEntry>
> = Object.freeze(
  Object.fromEntries(
    MOG_VERIFIED_UPGRADE_CATALOG.map((entry) => [entry.serverId, entry]),
  ) as Record<MogVerifiedUpgradeServerId, MogVerifiedUpgradeCatalogEntry>,
);

export function getVerifiedUpgradeCatalogEntry(
  upgradeId: string,
): MogVerifiedUpgradeCatalogEntry | null {
  return MOG_VERIFIED_UPGRADE_CATALOG_BY_SERVER_ID[upgradeId as MogVerifiedUpgradeServerId] ?? null;
}

export function getUpgradeUiLabel(upgradeId: string): string {
  return getVerifiedUpgradeCatalogEntry(upgradeId)?.name ?? upgradeId;
}

export function getUpgradeUiDescription(
  upgradeId: string,
  options?: { runType?: string | null },
): string | null {
  const entry = getVerifiedUpgradeCatalogEntry(upgradeId);
  if (!entry) return null;

  const template =
    options?.runType === "WORLD" && entry.worldDescriptionTemplate
      ? entry.worldDescriptionTemplate
      : entry.descriptionTemplate;

  return formatUpgradeTemplate(template, entry.modalParams);
}

export function getUpgradeUiTooltip(
  upgradeId: string,
  options?: { runType?: string | null },
): string | null {
  const entry = getVerifiedUpgradeCatalogEntry(upgradeId);
  if (!entry) return null;

  const template =
    options?.runType === "WORLD" && entry.worldDescriptionTemplate
      ? entry.worldDescriptionTemplate
      : entry.tooltipTemplate;

  if (!template) return null;
  return formatUpgradeTemplate(template, entry.modalParams);
}

export function getUpgradeUiFloorsLeft(
  upgradeId: string,
  params: {
    gameState?: Pick<GameStateSnapshot, "currentFloor" | "upgradesPerFloor"> | null | undefined;
    player?: Pick<GamePlayerSnapshot, "buffsRaw"> | null | undefined;
  },
): number | null {
  const passiveDurations = params.player?.buffsRaw?.passiveBuffDurations;
  if (passiveDurations && typeof passiveDurations === "object") {
    const passiveDurationValue = (passiveDurations as Record<string, unknown>)[upgradeId];
    if (typeof passiveDurationValue === "number" && Number.isFinite(passiveDurationValue) && passiveDurationValue > 0) {
      return Math.max(0, Math.round(passiveDurationValue));
    }
  }

  const catalogEntry = getUpgradeCatalogEntry(upgradeId);
  if (catalogEntry?.durationUnit !== "floors" || typeof catalogEntry.durationValue !== "number" || catalogEntry.durationValue <= 0) {
    return null;
  }
  if (!params.gameState || typeof params.gameState.currentFloor !== "number") return null;

  const matchingFloors = Object.entries(params.gameState.upgradesPerFloor ?? {})
    .filter(([, appliedUpgradeId]) => appliedUpgradeId === upgradeId)
    .map(([floor]) => Number(floor))
    .filter((floor): floor is number => Number.isFinite(floor))
    .sort((left, right) => right - left);
  const appliedFloor = matchingFloors[0];
  if (typeof appliedFloor !== "number") return null;

  const floorsLeft = catalogEntry.durationValue - (params.gameState.currentFloor - appliedFloor);
  return floorsLeft > 0 ? floorsLeft : null;
}

export function getUpgradeUiDurationLabel(upgradeId: string): string | null {
  const catalogEntry = getUpgradeCatalogEntry(upgradeId);
  if (!catalogEntry?.durationUnit || typeof catalogEntry.durationValue !== "number" || catalogEntry.durationValue <= 0) {
    return null;
  }

  const roundedDuration = Math.max(0, Math.round(catalogEntry.durationValue));
  if (catalogEntry.durationUnit === "floors") return `${roundedDuration}F`;
  if (catalogEntry.durationUnit === "turns") return `${roundedDuration}T`;
  if (catalogEntry.durationUnit === "moves") return `${roundedDuration}M`;
  if (catalogEntry.durationUnit === "charges") return `${roundedDuration}C`;
  return null;
}

export function getUpgradeUiDurationText(upgradeId: string): string | null {
  const catalogEntry = getUpgradeCatalogEntry(upgradeId);
  if (!catalogEntry?.durationUnit || typeof catalogEntry.durationValue !== "number" || catalogEntry.durationValue <= 0) {
    return null;
  }

  const roundedDuration = Math.max(0, Math.round(catalogEntry.durationValue));
  if (catalogEntry.durationUnit === "floors") return `(${roundedDuration} floors)`;
  if (catalogEntry.durationUnit === "turns") return `(${roundedDuration} turns)`;
  if (catalogEntry.durationUnit === "moves") return `(${roundedDuration} moves)`;
  if (catalogEntry.durationUnit === "charges") return `(${roundedDuration} charges)`;
  return null;
}

function formatUpgradeTemplate(template: string, params: Record<string, number>) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const normalizedKey = key.trim();
    const value = params[normalizedKey];
    return typeof value === "number" && Number.isFinite(value) ? String(value) : match;
  });
}
