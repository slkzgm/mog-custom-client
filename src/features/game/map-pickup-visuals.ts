import type { MapEntitySnapshot } from "./game.types";

export type PickupVisualCategory = "energy" | "treasure" | "marble" | "generic";

export interface PickupVisualDefinition {
  category: PickupVisualCategory;
  label: string;
  token: string;
  accent: string;
  badgeTone: "energy" | "treasure" | "marble" | "value";
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
  generic: {
    category: "generic",
    label: "Pickup",
    token: "+",
    accent: "pickup-generic",
    badgeTone: "value",
  },
};

function normalizePickupType(value: string) {
  return value.trim().toLowerCase();
}

export function resolvePickupVisualCategory(type: string): PickupVisualCategory {
  const normalized = normalizePickupType(type);
  if (normalized.includes("energy")) return "energy";
  if (normalized.includes("treasure")) return "treasure";
  if (normalized.includes("marble")) return "marble";
  return "generic";
}

export function resolvePickupVisual(typeOrEntity: string | MapEntitySnapshot): PickupVisualDefinition {
  const type = typeof typeOrEntity === "string" ? typeOrEntity : typeOrEntity.type;
  return pickupVisualDefinitions[resolvePickupVisualCategory(type)];
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
    if (left.count !== right.count) return right.count - left.count;
    return left.type.localeCompare(right.type);
  });
}
