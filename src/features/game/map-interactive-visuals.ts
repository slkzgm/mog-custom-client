import type { MapEntitySnapshot } from "./game.types";

export type InteractiveVisualCategory =
  | "stairs"
  | "fountain"
  | "rock"
  | "portal"
  | "breakable"
  | "chest"
  | "generic";

export interface InteractiveVisualDefinition {
  category: InteractiveVisualCategory;
  label: string;
  token: string;
  accent: string;
  showToken: boolean;
  useWallSurface: boolean;
}

const interactiveVisualDefinitions: Record<InteractiveVisualCategory, InteractiveVisualDefinition> = {
  stairs: {
    category: "stairs",
    label: "Stairs",
    token: ">",
    accent: "stairs",
    showToken: true,
    useWallSurface: false,
  },
  fountain: {
    category: "fountain",
    label: "Fountain",
    token: "F",
    accent: "fountain",
    showToken: true,
    useWallSurface: false,
  },
  rock: {
    category: "rock",
    label: "Wall",
    token: "",
    accent: "wall",
    showToken: false,
    useWallSurface: true,
  },
  portal: {
    category: "portal",
    label: "Portal",
    token: "O",
    accent: "portal",
    showToken: true,
    useWallSurface: false,
  },
  breakable: {
    category: "breakable",
    label: "Breakable",
    token: "B",
    accent: "breakable",
    showToken: true,
    useWallSurface: false,
  },
  chest: {
    category: "chest",
    label: "Chest",
    token: "C",
    accent: "chest",
    showToken: true,
    useWallSurface: false,
  },
  generic: {
    category: "generic",
    label: "Interactive",
    token: "I",
    accent: "interactive",
    showToken: true,
    useWallSurface: false,
  },
};

function normalizeInteractiveType(value: string) {
  return value.trim().toLowerCase();
}

export function isRockInteractive(typeOrEntity: string | MapEntitySnapshot) {
  const type = typeof typeOrEntity === "string" ? typeOrEntity : typeOrEntity.type;
  return normalizeInteractiveType(type) === "rock";
}

function isSpentFountain(entity: MapEntitySnapshot) {
  const normalized = normalizeInteractiveType(entity.type);
  if (!normalized.includes("fountain")) return false;
  if (typeof entity.value === "number" && entity.value <= 0) return true;
  return normalized.includes("used") || normalized.includes("spent") || normalized.includes("empty") || normalized.includes("depleted");
}

export function resolveInteractiveVisualCategory(type: string): InteractiveVisualCategory {
  const normalized = normalizeInteractiveType(type);
  if (normalized === "stairs") return "stairs";
  if (normalized === "fountain") return "fountain";
  if (normalized === "rock") return "rock";
  if (normalized === "portal") return "portal";
  if (normalized === "pot" || normalized === "crate") return "breakable";
  if (normalized === "chest") return "chest";
  return "generic";
}

export function resolveInteractiveVisual(typeOrEntity: string | MapEntitySnapshot): InteractiveVisualDefinition {
  if (typeof typeOrEntity !== "string" && isSpentFountain(typeOrEntity)) {
    return {
      ...interactiveVisualDefinitions.fountain,
      accent: "fountain-spent",
    };
  }

  const type = typeof typeOrEntity === "string" ? typeOrEntity : typeOrEntity.type;
  return interactiveVisualDefinitions[resolveInteractiveVisualCategory(type)];
}

export function interactiveSymbol(typeOrEntity: string | MapEntitySnapshot): string {
  return resolveInteractiveVisual(typeOrEntity).token;
}

export function interactiveValueText(typeOrEntity: string | Pick<MapEntitySnapshot, "value">): string | null {
  if (typeof typeOrEntity === "string") return null;
  if (typeof typeOrEntity.value !== "number" || !Number.isFinite(typeOrEntity.value)) return null;
  return String(Math.max(0, Math.round(typeOrEntity.value)));
}
