import type { EnemySnapshot, GameStateSnapshot, MapEntitySnapshot, TorchSnapshot } from "../game.types";

export const encounterCategoryOrder = [
  "enemies",
  "interactive",
  "pickups",
  "traps",
  "arrowTraps",
  "portals",
  "torches",
] as const;

export type EncounterCategory = (typeof encounterCategoryOrder)[number];

export interface EncounterCatalogEntry {
  key: string;
  category: EncounterCategory;
  displayName: string;
  type: string;
  sightings: number;
  firstSeenAt: string;
  lastSeenAt: string;
  floors: number[];
  sampleIds: string[];
  sampleSpriteTypes: string[];
  sampleValues: number[];
  sampleDamage: number[];
  sampleTileIndices: number[];
  isRevealedStates: Array<boolean | null>;
}

export interface EncounterCatalog {
  version: 1;
  updatedAt: string | null;
  entries: Record<EncounterCategory, EncounterCatalogEntry[]>;
}

const MAX_SAMPLES = 6;

function emptyEntries(): Record<EncounterCategory, EncounterCatalogEntry[]> {
  return {
    enemies: [],
    interactive: [],
    pickups: [],
    traps: [],
    arrowTraps: [],
    portals: [],
    torches: [],
  };
}

export function createEmptyEncounterCatalog(): EncounterCatalog {
  return {
    version: 1,
    updatedAt: null,
    entries: emptyEntries(),
  };
}

function normalizeType(value: string) {
  return value.trim().toLowerCase();
}

function pushUnique<T>(values: T[], nextValue: T) {
  if (values.includes(nextValue)) return values;
  return [...values, nextValue].slice(0, MAX_SAMPLES);
}

function toSortedNumbers(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

function sortEntries(entries: EncounterCatalogEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.sightings !== left.sightings) return right.sightings - left.sightings;
    return left.displayName.localeCompare(right.displayName);
  });
}

function recordEntry(
  lookup: Map<string, EncounterCatalogEntry>,
  params: {
    category: EncounterCategory;
    type: string;
    displayName?: string;
    seenAt: string;
    floor: number | null;
    id?: string | null;
    spriteType?: string | null;
    value?: number | null;
    damage?: number | null;
    tileIndex?: number | null;
    isRevealed?: boolean | null;
  },
) {
  const normalizedType = normalizeType(params.type);
  if (!normalizedType) return false;

  const existing = lookup.get(normalizedType);
  const nextDisplayName = params.displayName?.trim() || params.type.trim();
  const nextFloors =
    typeof params.floor === "number" ? toSortedNumbers(pushUnique(existing?.floors ?? [], params.floor)) : existing?.floors ?? [];
  const nextSampleIds = params.id ? pushUnique(existing?.sampleIds ?? [], params.id) : existing?.sampleIds ?? [];
  const nextSpriteTypes =
    params.spriteType && params.spriteType.trim()
      ? pushUnique(existing?.sampleSpriteTypes ?? [], params.spriteType.trim())
      : existing?.sampleSpriteTypes ?? [];
  const nextSampleValues =
    typeof params.value === "number" ? toSortedNumbers(pushUnique(existing?.sampleValues ?? [], params.value)) : existing?.sampleValues ?? [];
  const nextSampleDamage =
    typeof params.damage === "number"
      ? toSortedNumbers(pushUnique(existing?.sampleDamage ?? [], params.damage))
      : existing?.sampleDamage ?? [];
  const nextSampleTileIndices =
    typeof params.tileIndex === "number"
      ? toSortedNumbers(pushUnique(existing?.sampleTileIndices ?? [], params.tileIndex))
      : existing?.sampleTileIndices ?? [];
  const nextRevealStates =
    params.isRevealed === undefined ? existing?.isRevealedStates ?? [] : pushUnique(existing?.isRevealedStates ?? [], params.isRevealed);

  if (!existing) {
    lookup.set(normalizedType, {
      key: normalizedType,
      category: params.category,
      displayName: nextDisplayName,
      type: params.type.trim(),
      sightings: 1,
      firstSeenAt: params.seenAt,
      lastSeenAt: params.seenAt,
      floors: nextFloors,
      sampleIds: nextSampleIds,
      sampleSpriteTypes: nextSpriteTypes,
      sampleValues: nextSampleValues,
      sampleDamage: nextSampleDamage,
      sampleTileIndices: nextSampleTileIndices,
      isRevealedStates: nextRevealStates,
    });
    return true;
  }

  const nextEntry: EncounterCatalogEntry = {
    ...existing,
    displayName: existing.displayName || nextDisplayName,
    type: existing.type || params.type.trim(),
    sightings: existing.sightings + 1,
    lastSeenAt: params.seenAt,
    floors: nextFloors,
    sampleIds: nextSampleIds,
    sampleSpriteTypes: nextSpriteTypes,
    sampleValues: nextSampleValues,
    sampleDamage: nextSampleDamage,
    sampleTileIndices: nextSampleTileIndices,
    isRevealedStates: nextRevealStates,
  };

  const changed =
    nextEntry.sightings !== existing.sightings ||
    nextEntry.lastSeenAt !== existing.lastSeenAt ||
    nextEntry.floors !== existing.floors ||
    nextEntry.sampleIds !== existing.sampleIds ||
    nextEntry.sampleSpriteTypes !== existing.sampleSpriteTypes ||
    nextEntry.sampleValues !== existing.sampleValues ||
    nextEntry.sampleDamage !== existing.sampleDamage ||
    nextEntry.sampleTileIndices !== existing.sampleTileIndices ||
    nextEntry.isRevealedStates !== existing.isRevealedStates;

  if (!changed) return false;
  lookup.set(normalizedType, nextEntry);
  return true;
}

function mergeEntityGroup<T extends MapEntitySnapshot>(
  lookup: Map<string, EncounterCatalogEntry>,
  category: EncounterCategory,
  items: T[],
  gameState: GameStateSnapshot,
  readExtras?: (item: T) => {
    displayName?: string;
    spriteType?: string | null;
    isRevealed?: boolean | null;
  },
) {
  let changed = false;
  const seenAt = new Date().toISOString();
  const floor = gameState.currentFloor ?? null;

  for (const item of items) {
    const extras = readExtras?.(item);
    changed =
      recordEntry(lookup, {
        category,
        type: item.type,
        displayName: extras?.displayName,
        seenAt,
        floor,
        id: item.id,
        spriteType: extras?.spriteType,
        value: item.value,
        damage: item.damage,
        tileIndex: item.tileIndex,
        isRevealed: extras?.isRevealed,
      }) || changed;
  }

  return changed;
}

export function recordGameStateEncounters(catalog: EncounterCatalog, gameState: GameStateSnapshot): EncounterCatalog {
  const nextEntries = emptyEntries();
  const entryLookups = Object.fromEntries(
    encounterCategoryOrder.map((category) => [
      category,
      new Map((catalog.entries[category] ?? []).map((entry) => [entry.key, entry])),
    ]),
  ) as Record<EncounterCategory, Map<string, EncounterCatalogEntry>>;

  let hasChanges = false;

  hasChanges = mergeEntityGroup(entryLookups.enemies, "enemies", gameState.enemies, gameState, (enemy: EnemySnapshot) => ({
    displayName: enemy.spriteType ? `${enemy.type} (${enemy.spriteType})` : enemy.type,
    spriteType: enemy.spriteType,
  })) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.interactive, "interactive", gameState.interactive, gameState) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.pickups, "pickups", gameState.pickups, gameState) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.traps, "traps", gameState.traps, gameState) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.arrowTraps, "arrowTraps", gameState.arrowTraps, gameState) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.portals, "portals", gameState.portals, gameState) || hasChanges;
  hasChanges = mergeEntityGroup(entryLookups.torches, "torches", gameState.torches, gameState, (torch: TorchSnapshot) => ({
    isRevealed: torch.isRevealed,
  })) || hasChanges;

  for (const category of encounterCategoryOrder) {
    nextEntries[category] = sortEntries(Array.from(entryLookups[category].values()));
  }

  if (!hasChanges) return catalog;

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: nextEntries,
  };
}

function mergeEntrySamples(left: EncounterCatalogEntry, right: EncounterCatalogEntry): EncounterCatalogEntry {
  return {
    ...left,
    displayName: left.displayName || right.displayName,
    type: left.type || right.type,
    sightings: Math.max(left.sightings, right.sightings),
    firstSeenAt: left.firstSeenAt <= right.firstSeenAt ? left.firstSeenAt : right.firstSeenAt,
    lastSeenAt: left.lastSeenAt >= right.lastSeenAt ? left.lastSeenAt : right.lastSeenAt,
    floors: toSortedNumbers([...new Set([...left.floors, ...right.floors])]),
    sampleIds: [...new Set([...left.sampleIds, ...right.sampleIds])].slice(0, MAX_SAMPLES),
    sampleSpriteTypes: [...new Set([...left.sampleSpriteTypes, ...right.sampleSpriteTypes])].slice(0, MAX_SAMPLES),
    sampleValues: toSortedNumbers([...new Set([...left.sampleValues, ...right.sampleValues])]).slice(0, MAX_SAMPLES),
    sampleDamage: toSortedNumbers([...new Set([...left.sampleDamage, ...right.sampleDamage])]).slice(0, MAX_SAMPLES),
    sampleTileIndices: toSortedNumbers([...new Set([...left.sampleTileIndices, ...right.sampleTileIndices])]).slice(0, MAX_SAMPLES),
    isRevealedStates: [...new Set([...left.isRevealedStates, ...right.isRevealedStates])].slice(0, MAX_SAMPLES),
  };
}

export function mergeEncounterCatalogs(left: EncounterCatalog, right: EncounterCatalog): EncounterCatalog {
  const mergedEntries = emptyEntries();
  let hasChanges = false;

  for (const category of encounterCategoryOrder) {
    const lookup = new Map<string, EncounterCatalogEntry>();

    for (const entry of left.entries[category] ?? []) {
      lookup.set(entry.key, entry);
    }

    for (const entry of right.entries[category] ?? []) {
      const existing = lookup.get(entry.key);
      if (!existing) {
        lookup.set(entry.key, entry);
        hasChanges = true;
        continue;
      }

      const merged = mergeEntrySamples(existing, entry);
      const entryChanged =
        merged.sightings !== existing.sightings ||
        merged.firstSeenAt !== existing.firstSeenAt ||
        merged.lastSeenAt !== existing.lastSeenAt ||
        merged.floors.length !== existing.floors.length ||
        merged.sampleIds.length !== existing.sampleIds.length ||
        merged.sampleSpriteTypes.length !== existing.sampleSpriteTypes.length ||
        merged.sampleValues.length !== existing.sampleValues.length ||
        merged.sampleDamage.length !== existing.sampleDamage.length ||
        merged.sampleTileIndices.length !== existing.sampleTileIndices.length ||
        merged.isRevealedStates.length !== existing.isRevealedStates.length;

      if (entryChanged) {
        lookup.set(entry.key, merged);
        hasChanges = true;
      }
    }

    mergedEntries[category] = sortEntries(Array.from(lookup.values()));
  }

  if (!hasChanges) return left;

  const updatedAtCandidates = [left.updatedAt, right.updatedAt].filter((value): value is string => Boolean(value));

  return {
    version: 1,
    updatedAt: updatedAtCandidates.sort().at(-1) ?? new Date().toISOString(),
    entries: mergedEntries,
  };
}

function isEncounterCatalogEntry(value: unknown): value is EncounterCatalogEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EncounterCatalogEntry>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.category === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.sightings === "number" &&
    typeof candidate.firstSeenAt === "string" &&
    typeof candidate.lastSeenAt === "string" &&
    Array.isArray(candidate.floors) &&
    Array.isArray(candidate.sampleIds) &&
    Array.isArray(candidate.sampleSpriteTypes) &&
    Array.isArray(candidate.sampleValues) &&
    Array.isArray(candidate.sampleDamage) &&
    Array.isArray(candidate.sampleTileIndices) &&
    Array.isArray(candidate.isRevealedStates)
  );
}

export function sanitizeEncounterCatalog(value: unknown): EncounterCatalog {
  if (!value || typeof value !== "object") return createEmptyEncounterCatalog();
  const candidate = value as Partial<EncounterCatalog>;

  const entries = emptyEntries();
  const sourceEntries = candidate.entries;

  for (const category of encounterCategoryOrder) {
    const rawCategoryEntries = sourceEntries && typeof sourceEntries === "object" ? sourceEntries[category] : null;
    entries[category] = Array.isArray(rawCategoryEntries)
      ? rawCategoryEntries.filter(isEncounterCatalogEntry).map((entry) => ({
          ...entry,
          category,
        }))
      : [];
  }

  return {
    version: 1,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    entries,
  };
}

export function summarizeEncounterCatalog(catalog: EncounterCatalog) {
  const groups = encounterCategoryOrder.map((category) => ({
    category,
    label:
      category === "enemies"
        ? "Enemies"
        : category === "interactive"
          ? "Interactive"
          : category === "pickups"
            ? "Pickups"
            : category === "traps"
              ? "Traps"
              : category === "arrowTraps"
                ? "Arrow traps"
                : category === "portals"
                  ? "Portals"
                  : "Torches",
    entries: catalog.entries[category],
  }));

  return {
    groups,
    totalVariants: groups.reduce((total, group) => total + group.entries.length, 0),
    totalSightings: groups.reduce(
      (total, group) => total + group.entries.reduce((groupTotal, entry) => groupTotal + entry.sightings, 0),
      0,
    ),
  };
}
