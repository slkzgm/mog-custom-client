import type { MapEntitySnapshot } from "./game.types";

export type PickupVisualCategory = "energy" | "treasure" | "marble" | "generic";

export interface PickupVisualDefinition {
  category: PickupVisualCategory;
  label: string;
  token: string;
  accent: string;
}

const pickupVisualDefinitions: Record<PickupVisualCategory, PickupVisualDefinition> = {
  energy: {
    category: "energy",
    label: "Energy orb",
    token: "E",
    accent: "pickup-energy",
  },
  treasure: {
    category: "treasure",
    label: "Treasure",
    token: "$",
    accent: "pickup-treasure",
  },
  marble: {
    category: "marble",
    label: "Marble",
    token: "M",
    accent: "pickup-marble",
  },
  generic: {
    category: "generic",
    label: "Pickup",
    token: "+",
    accent: "pickup-generic",
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
