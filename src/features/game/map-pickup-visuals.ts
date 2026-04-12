import type { MapEntitySnapshot } from "./game.types";

export type PickupVisualCategory = "energy" | "treasure" | "marble" | "amber" | "generic";

export interface PickupVisualDefinition {
  category: PickupVisualCategory;
  label: string;
  token: string;
  accent: string;
  badgeTone: "energy" | "treasure" | "marble" | "jackpot" | "value";
}

const pickupVisualDefinitions: Record<PickupVisualCategory, PickupVisualDefinition> = {
  energy: {
    category: "energy",
    label: "Energy orb",
    token: "E",
    accent: "pickup-energy",
    badgeTone: "energy",
  },
  treasure: {
    category: "treasure",
    label: "Treasure",
    token: "$",
    accent: "pickup-treasure",
    badgeTone: "treasure",
  },
  marble: {
    category: "marble",
    label: "Marble",
    token: "M",
    accent: "pickup-marble",
    badgeTone: "marble",
  },
  amber: {
    category: "amber",
    label: "Amber",
    token: "A",
    accent: "pickup-amber",
    badgeTone: "treasure",
  },
  generic: {
    category: "generic",
    label: "Pickup",
    token: "+",
    accent: "pickup-generic",
    badgeTone: "value",
  },
};

const exactPickupVisualDefinitions: Record<string, PickupVisualDefinition> = {
  small_energy_orb: pickupVisualDefinitions.energy,
  large_energy_orb: pickupVisualDefinitions.energy,
  marble: pickupVisualDefinitions.marble,
  treasure: pickupVisualDefinitions.treasure,
  amber: pickupVisualDefinitions.amber,
  jackpot: {
    category: "treasure",
    label: "Jackpot",
    token: "JP",
    accent: "pickup-treasure",
    badgeTone: "jackpot",
  },
  jackpot_minor: {
    category: "treasure",
    label: "Minor jackpot",
    token: "JP",
    accent: "pickup-treasure",
    badgeTone: "jackpot",
  },
  jackpot_major: {
    category: "treasure",
    label: "Major jackpot",
    token: "JP",
    accent: "pickup-treasure",
    badgeTone: "jackpot",
  },
  jackpot_mega: {
    category: "treasure",
    label: "Mega jackpot",
    token: "JP",
    accent: "pickup-treasure",
    badgeTone: "jackpot",
  },
  raffle_ticket: {
    category: "treasure",
    label: "Raffle ticket",
    token: "RT",
    accent: "pickup-treasure",
    badgeTone: "treasure",
  },
  hongbao: {
    category: "generic",
    label: "HongBao",
    token: "HB",
    accent: "pickup-generic",
    badgeTone: "value",
  },
  abs: {
    category: "generic",
    label: "ABS drop",
    token: "ABS",
    accent: "pickup-generic",
    badgeTone: "value",
  },
};

function normalizePickupType(value: string) {
  return value.trim().toLowerCase();
}

export function resolvePickupVisualCategory(type: string): PickupVisualCategory {
  const normalized = normalizePickupType(type);
  if (normalized in exactPickupVisualDefinitions) return exactPickupVisualDefinitions[normalized].category;
  if (normalized.includes("energy")) return "energy";
  if (normalized.includes("amber")) return "amber";
  if (normalized.includes("treasure")) return "treasure";
  if (normalized.includes("marble")) return "marble";
  return "generic";
}

export function resolvePickupVisual(typeOrEntity: string | MapEntitySnapshot): PickupVisualDefinition {
  const type = typeof typeOrEntity === "string" ? typeOrEntity : typeOrEntity.type;
  const normalized = normalizePickupType(type);
  return exactPickupVisualDefinitions[normalized] ?? pickupVisualDefinitions[resolvePickupVisualCategory(type)];
}

export function pickupValueText(value: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `+${Math.max(0, Math.round(value))}`;
}

export interface PickupStackVisual {
  type: string;
  count: number;
  totalValue: number | null;
  visual: PickupVisualDefinition;
}

function pickupCategoryPriority(category: PickupVisualCategory) {
  if (category === "energy") return 0;
  if (category === "amber" || category === "treasure") return 1;
  if (category === "marble") return 2;
  return 3;
}

function pickupTypePriority(type: string) {
  const normalized = normalizePickupType(type);
  if (normalized === "jackpot_mega") return -4;
  if (normalized === "jackpot_major") return -3;
  if (normalized === "jackpot_minor") return -2;
  if (normalized === "jackpot") return -1;
  return 0;
}

export function buildPickupStacks(pickups: MapEntitySnapshot[]): PickupStackVisual[] {
  const grouped = new Map<string, PickupStackVisual>();

  for (const pickup of pickups) {
    const key = pickup.type.trim().toLowerCase() || "pickup";
    const visual = resolvePickupVisual(pickup);
    const existing = grouped.get(key);
    const nextValue = typeof pickup.value === "number" && Number.isFinite(pickup.value) ? pickup.value : null;

    if (!existing) {
      grouped.set(key, {
        type: pickup.type,
        count: 1,
        totalValue: nextValue,
        visual,
      });
      continue;
    }

    grouped.set(key, {
      ...existing,
      count: existing.count + 1,
      totalValue:
        existing.totalValue === null || nextValue === null ? existing.totalValue ?? nextValue : existing.totalValue + nextValue,
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const typeDelta = pickupTypePriority(left.type) - pickupTypePriority(right.type);
    if (typeDelta !== 0) return typeDelta;
    const categoryDelta = pickupCategoryPriority(left.visual.category) - pickupCategoryPriority(right.visual.category);
    if (categoryDelta !== 0) return categoryDelta;
    if (left.totalValue !== null && right.totalValue !== null && left.totalValue !== right.totalValue) {
      return right.totalValue - left.totalValue;
    }
    if (left.count !== right.count) return right.count - left.count;
    return left.type.localeCompare(right.type);
  });
}
