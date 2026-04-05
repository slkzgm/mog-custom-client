import { useCallback, useMemo, useState } from "react";

import { appConfig } from "../../../app/config";
import { findPortalAtPosition } from "../game-map";
import { useEncounterCatalog } from "../runtime/use-encounter-catalog";
import {
  parseLatestPortalPromptEvent,
  parseShroomChargingEvents,
  type ShroomTargetTile,
} from "../runtime/game-event-parsers";
import { useMapEntityMemory } from "../runtime/use-map-entity-memory";
import { useMapFogMemory } from "../runtime/use-map-fog-memory";
import { useMapSnapshotProbe } from "../runtime/use-map-snapshot-probe";
import { useMapVisitedCells } from "../runtime/use-map-visited-cells";
import type {
  CellEntity,
  CellHint,
  FocusViewportSize,
  MapBoardCellViewModel,
  MapBoardV2Props,
} from "./map-board-v2.types";
import {
  buildEntityPositionLookups,
  buildHints,
  buildViewport,
  clamp,
  fogStateAt,
  getFocusOffsetBounds,
  keyOf,
  parseCoordinateKey,
  predictEnemyNextMoveDirection,
  rememberedEntityToCellEntity,
  resolveFocusWindow,
  resolveEntityWithLookups,
  selectedEnemyIntent,
  tileKindAtWithLookups,
} from "./map-board-v2.utils";

function buildRange(min: number, max: number) {
  if (max < min) return [];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

function buildShroomDangerLookup(shroomChargingEvents: ReturnType<typeof parseShroomChargingEvents>) {
  const tiles = new Map<string, ShroomTargetTile>();

  for (const event of shroomChargingEvents) {
    for (const tile of event.targetTiles) {
      tiles.set(keyOf(tile.x, tile.y), tile);
    }
  }

  return tiles;
}

function withPortalPromptBadge(
  entity: CellEntity | null,
  portalCostText: string | null,
  isVisited: boolean,
) {
  if (!entity) return null;

  const normalizedEntity =
    entity.kind === "interactive" && entity.accent === "fountain" && isVisited
      ? { ...entity, accent: "fountain-spent", label: "Fountain (spent)" }
      : entity;

  if (!portalCostText) return normalizedEntity;

  return {
    ...normalizedEntity,
    isPortalPromptActive: true,
    badges: [
      ...normalizedEntity.badges,
      {
        position: "se" as const,
        text: portalCostText,
        tone: "warning" as const,
      },
    ],
  };
}

function resolveCellAction(params: {
  hint: CellHint | null;
  isPlayerTile: boolean;
  isActionLocked: boolean;
  onDirectionalAction: MapBoardV2Props["onDirectionalAction"];
  onPassAction: MapBoardV2Props["onPassAction"];
  onPortalAction: MapBoardV2Props["onPortalAction"];
  isPortalActionDisabled: boolean;
  playerPortal: ReturnType<typeof findPortalAtPosition>;
  portalAtCell: ReturnType<typeof findPortalAtPosition>;
}) {
  const {
    hint,
    isPlayerTile,
    isActionLocked,
    onDirectionalAction,
    onPassAction,
    onPortalAction,
    isPortalActionDisabled,
    playerPortal,
    portalAtCell,
  } = params;

  if (
    playerPortal &&
    portalAtCell &&
    (!isPlayerTile || portalAtCell.id !== playerPortal.id) &&
    onPortalAction &&
    !isPortalActionDisabled &&
    !isActionLocked
  ) {
    return { kind: "portal" as const };
  }

  if (isPlayerTile && onPassAction && !isActionLocked) {
    return { kind: "pass" as const };
  }

  if (hint && hint.kind !== "blocked" && onDirectionalAction && !isActionLocked) {
    return { kind: "direction" as const, direction: hint.direction };
  }

  return null;
}

export function useMapBoardV2Model({
  gameState,
  optimisticPlayerPosition = null,
  focusViewportSize = null,
  moveEvents = [],
  portalPrompt = null,
  onDirectionalAction,
  onPassAction,
  onPortalAction,
  isPortalActionDisabled = false,
  isActionLocked,
}: Pick<
  MapBoardV2Props,
  | "gameState"
  | "optimisticPlayerPosition"
  | "moveEvents"
  | "portalPrompt"
  | "onDirectionalAction"
  | "onPassAction"
  | "onPortalAction"
  | "isPortalActionDisabled"
> & { isActionLocked: boolean; focusViewportSize?: FocusViewportSize | null }) {
  const [viewMode, setViewMode] = useState<"focus" | "full">("focus");
  const [focusRadius, setFocusRadius] = useState(6);
  const currentTurnKey = `${gameState.runId ?? "no-run"}:${gameState.currentFloor ?? "?"}:${gameState.turnNumber ?? "?"}`;
  const [focusOffsetState, setFocusOffsetState] = useState({
    offset: { x: 0, y: 0 },
    turnKey: currentTurnKey,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const isEncounterCatalogEnabled = appConfig.features.encounterCatalog;
  const isMapFogMemoryEnabled = appConfig.features.mapFogMemory;
  const isMapSnapshotProbeEnabled = appConfig.features.mapSnapshotProbe;
  const isMapVisitedCellsEnabled = appConfig.features.mapVisitedCells;

  const encounterCatalog = useEncounterCatalog(gameState, isEncounterCatalogEnabled);
  const entityMemory = useMapEntityMemory(gameState, isMapFogMemoryEnabled);
  const fogMemory = useMapFogMemory(gameState, isMapFogMemoryEnabled);
  const mapSnapshotProbe = useMapSnapshotProbe(gameState, isMapSnapshotProbeEnabled);
  const visitedCells = useMapVisitedCells(gameState, isMapVisitedCellsEnabled);
  const mapHeight = gameState.mapData?.length ?? 0;
  const mapWidth = gameState.mapData?.[0]?.length ?? 0;
  const displayGameState = useMemo(() => {
    if (!optimisticPlayerPosition || !gameState.player) return gameState;

    return {
      ...gameState,
      player: {
        ...gameState.player,
        x: optimisticPlayerPosition.x,
        y: optimisticPlayerPosition.y,
      },
    };
  }, [gameState, optimisticPlayerPosition]);

  const effectiveFocusOffset = useMemo(
    () => (focusOffsetState.turnKey === currentTurnKey ? focusOffsetState.offset : { x: 0, y: 0 }),
    [currentTurnKey, focusOffsetState.offset, focusOffsetState.turnKey],
  );
  const focusWindow = useMemo(
    () => resolveFocusWindow(mapWidth, mapHeight, focusRadius, focusViewportSize),
    [focusRadius, focusViewportSize, mapHeight, mapWidth],
  );
  const focusOffsetBounds = useMemo(
    () => getFocusOffsetBounds(displayGameState, focusWindow),
    [displayGameState, focusWindow],
  );
  const clampedFocusOffset = useMemo(
    () => ({
      x: clamp(effectiveFocusOffset.x, focusOffsetBounds.minX, focusOffsetBounds.maxX),
      y: clamp(effectiveFocusOffset.y, focusOffsetBounds.minY, focusOffsetBounds.maxY),
    }),
    [effectiveFocusOffset.x, effectiveFocusOffset.y, focusOffsetBounds.maxX, focusOffsetBounds.maxY, focusOffsetBounds.minX, focusOffsetBounds.minY],
  );
  const viewport = useMemo(
    () => buildViewport(displayGameState, viewMode, focusWindow, clampedFocusOffset),
    [clampedFocusOffset, displayGameState, focusWindow, viewMode],
  );
  const entityLookups = useMemo(() => buildEntityPositionLookups(gameState), [gameState]);
  const hintsByKey = useMemo(() => buildHints(displayGameState), [displayGameState]);
  const xValues = useMemo(() => buildRange(viewport.minX, viewport.maxX), [viewport.maxX, viewport.minX]);
  const yValues = useMemo(() => buildRange(viewport.minY, viewport.maxY), [viewport.maxY, viewport.minY]);
  const focusWindowSize = focusRadius * 2 + 1;
  const fallbackKey = displayGameState.player ? keyOf(displayGameState.player.x, displayGameState.player.y) : null;
  const activeSelectedKey = selectedKey ?? fallbackKey;
  const selectedEnemy = activeSelectedKey ? entityLookups.enemyByKey.get(activeSelectedKey) ?? null : null;

  const playerPortal = useMemo(() => {
    const player = displayGameState.player;
    if (!player) return null;
    return entityLookups.portalByKey.get(keyOf(player.x, player.y)) ?? null;
  }, [displayGameState.player, entityLookups.portalByKey]);
  const latestPortalPrompt = useMemo(
    () => portalPrompt ?? parseLatestPortalPromptEvent(moveEvents),
    [moveEvents, portalPrompt],
  );
  const promptedPortalKey = useMemo(
    () => (latestPortalPrompt ? keyOf(latestPortalPrompt.portalX, latestPortalPrompt.portalY) : null),
    [latestPortalPrompt],
  );
  const selectedPortal = useMemo(() => {
    if (!activeSelectedKey) return null;
    const coordinates = parseCoordinateKey(activeSelectedKey);
    if (!coordinates) return null;
    return entityLookups.portalByKey.get(keyOf(coordinates.x, coordinates.y)) ?? null;
  }, [activeSelectedKey, entityLookups.portalByKey]);
  const isSelectedPortalInActivePrompt = useMemo(
    () =>
      Boolean(
        latestPortalPrompt &&
          selectedPortal &&
          (selectedPortal.id === latestPortalPrompt.portalId || selectedPortal.id === latestPortalPrompt.linkedPortalId),
      ),
    [latestPortalPrompt, selectedPortal],
  );
  const shroomChargingEvents = useMemo(() => parseShroomChargingEvents(moveEvents), [moveEvents]);
  const shroomDangerTiles = useMemo(() => buildShroomDangerLookup(shroomChargingEvents), [shroomChargingEvents]);
  const selectedEnemyShroomCharge = useMemo(() => {
    if (!selectedEnemy?.id) return null;
    return shroomChargingEvents.find((event) => event.enemyId === selectedEnemy.id) ?? null;
  }, [selectedEnemy, shroomChargingEvents]);
  const selectedEnemyNextMoveDirection = useMemo(
    () => (selectedEnemy ? predictEnemyNextMoveDirection(displayGameState, selectedEnemy) : null),
    [displayGameState, selectedEnemy],
  );
  const selectedEnemyIntentText = useMemo(
    () =>
      selectedEnemyShroomCharge
        ? `line attack ${selectedEnemyShroomCharge.direction}`
        : selectedEnemy
          ? selectedEnemyIntent(displayGameState, selectedEnemy)
          : null,
    [displayGameState, selectedEnemy, selectedEnemyShroomCharge],
  );

  const cells = useMemo(() => {
    const nextCells: MapBoardCellViewModel[] = [];

    for (const y of yValues) {
      for (const x of xValues) {
        const key = keyOf(x, y);
        const currentFog = fogStateAt(displayGameState, x, y);
        const fog =
          currentFog !== "visible" && fogMemory.rememberedCoordinates.has(key) ? "remembered" : currentFog;
        const tile = tileKindAtWithLookups(displayGameState, x, y, entityLookups);
        const currentEntity = resolveEntityWithLookups(displayGameState, x, y, entityLookups);
        const rememberedEntity = entityMemory.rememberedEntities.get(key);
        const isVisited = visitedCells.visitedCoordinates.has(key);
        const shroomDanger = shroomDangerTiles.get(key) ?? null;
        const rawEntity =
          currentEntity ?? (rememberedEntity && currentFog !== "visible" ? rememberedEntityToCellEntity(rememberedEntity) : null);
        const portalCostText =
          promptedPortalKey === key && latestPortalPrompt && latestPortalPrompt.teleportCost !== null
            ? String(latestPortalPrompt.teleportCost)
            : null;
        const entity = withPortalPromptBadge(rawEntity, portalCostText, isVisited);
        const hint = hintsByKey.get(key) ?? null;
        const isSelected = key === activeSelectedKey;
        const isPlayerTile = Boolean(displayGameState.player && displayGameState.player.x === x && displayGameState.player.y === y);
        const portalAtCell = entityLookups.portalByKey.get(key) ?? null;
        const action = resolveCellAction({
          hint,
          isPlayerTile,
          isActionLocked,
          onDirectionalAction,
          onPassAction,
          onPortalAction,
          isPortalActionDisabled,
          playerPortal,
          portalAtCell,
        });

        nextCells.push({
          key,
          x,
          y,
          fog,
          tile,
          entity,
          action,
          shroomDanger,
          className: [
            "map2-cell",
            `map2-cell-${entity?.useWallSurface ? "wall" : tile}`,
            `map2-fog-${fog}`,
            isVisited ? "map2-cell-visited" : "",
            shroomDanger ? "map2-cell-shroom-danger" : "",
            shroomDanger?.isMaxRange ? "map2-cell-shroom-max-range" : "",
            entity?.isPortalPromptActive ? "map2-cell-portal-prompt" : "",
            entity ? `map2-entity-${entity.accent}` : "",
            hint ? `map2-hint-${hint.kind}` : "",
            isSelected ? "is-selected" : "",
          ]
            .filter(Boolean)
            .join(" "),
          title: `(${x},${y}) ${tile} ${entity?.label ?? ""}`.trim(),
        });
      }
    }

    return nextCells;
  }, [
    activeSelectedKey,
    entityMemory.rememberedEntities,
    entityLookups,
    displayGameState,
    fogMemory.rememberedCoordinates,
    hintsByKey,
    isActionLocked,
    isPortalActionDisabled,
    latestPortalPrompt,
    onDirectionalAction,
    onPassAction,
    onPortalAction,
    playerPortal,
    promptedPortalKey,
    shroomDangerTiles,
    visitedCells.visitedCoordinates,
    xValues,
    yValues,
  ]);

  const setFocusMode = useCallback((nextMode: "focus" | "full") => {
    setViewMode(nextMode);
  }, []);

  const zoomIn = useCallback(() => {
    setFocusRadius((current) => clamp(current - 1, 3, 16));
  }, []);

  const zoomOut = useCallback(() => {
    setFocusRadius((current) => clamp(current + 1, 3, 16));
  }, []);

  const panFocus = useCallback((deltaX: number, deltaY: number) => {
    setFocusOffsetState((current) => ({
      turnKey: currentTurnKey,
      offset: {
        x: clamp(
          (current.turnKey === currentTurnKey ? current.offset.x : 0) + deltaX,
          focusOffsetBounds.minX,
          focusOffsetBounds.maxX,
        ),
        y: clamp(
          (current.turnKey === currentTurnKey ? current.offset.y : 0) + deltaY,
          focusOffsetBounds.minY,
          focusOffsetBounds.maxY,
        ),
      },
    }));
  }, [currentTurnKey, focusOffsetBounds.maxX, focusOffsetBounds.maxY, focusOffsetBounds.minX, focusOffsetBounds.minY]);

  const setFocusOffset = useCallback((x: number, y: number) => {
    setFocusOffsetState({
      turnKey: currentTurnKey,
      offset: {
        x: clamp(x, focusOffsetBounds.minX, focusOffsetBounds.maxX),
        y: clamp(y, focusOffsetBounds.minY, focusOffsetBounds.maxY),
      },
    });
  }, [currentTurnKey, focusOffsetBounds.maxX, focusOffsetBounds.maxY, focusOffsetBounds.minX, focusOffsetBounds.minY]);

  const resetFocusOffset = useCallback(() => {
    setFocusOffsetState({
      offset: { x: 0, y: 0 },
      turnKey: currentTurnKey,
    });
  }, [currentTurnKey]);

  const handleSelectCell = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  const handleActivateCell = useCallback((cell: MapBoardCellViewModel) => {
    setSelectedKey(cell.key);

    if (cell.action?.kind === "portal") {
      void onPortalAction?.();
      return;
    }

    if (cell.action?.kind === "pass") {
      void onPassAction?.();
      return;
    }

    if (cell.action?.kind === "direction" && cell.action.direction) {
      void onDirectionalAction?.(cell.action.direction);
    }
  }, [onDirectionalAction, onPassAction, onPortalAction]);

  return {
    cells,
    columnCount: xValues.length,
    rowCount: yValues.length,
    hasMapData: xValues.length > 0 && yValues.length > 0,
    viewMode,
    focusWindowSize,
    focusOffset: clampedFocusOffset,
    effectiveFocusOffset: clampedFocusOffset,
    latestPortalPrompt,
    playerPortal,
    selectedEnemy,
    selectedEnemyIntentText,
    selectedEnemyNextMoveDirection,
    selectedEnemyShroomCharge,
    selectedPortal,
    activeSelectedKey,
    isSelectedPortalInActivePrompt,
    isEncounterCatalogEnabled,
    isMapFogMemoryEnabled,
    isMapSnapshotProbeEnabled,
    isMapVisitedCellsEnabled,
    encounterCatalog,
    entityMemory,
    fogMemory,
    mapSnapshotProbe,
    visitedCells,
    gameState,
    portalPrompt,
    setFocusMode,
    zoomIn,
    zoomOut,
    panFocus,
    setFocusOffset,
    resetFocusOffset,
    handleSelectCell,
    handleActivateCell,
    portalControl: {
      isPortalActionDisabled,
      onPortalAction,
    },
  };
}

export type MapBoardV2Model = ReturnType<typeof useMapBoardV2Model>;
