import type { EntityCornerBadge } from "../map-enemy-visuals";
import type { GameStateSnapshot, MoveDirection } from "../game.types";
import type { PortalPromptEvent, ShroomTargetTile } from "../runtime/game-event-parsers";

export type ViewMode = "focus" | "full";
export type FogState = "hidden" | "explored" | "visible" | "remembered";
export type TileKind = "wall" | "hard-wall" | "corridor" | "unknown" | "void";
export type HintKind = "move" | "attack" | "break" | "blocked";
export type EntityKind = "player" | "enemy" | "interactive" | "pickup" | "trap" | "arrow-trap" | "portal";

export interface MapBoardV2Props {
  gameState: GameStateSnapshot;
  moveEvents?: Record<string, unknown>[];
  portalPrompt?: PortalPromptEvent | null;
  onDirectionalAction?: (direction: MoveDirection) => void | Promise<void>;
  onPassAction?: () => void | Promise<void>;
  onPortalAction?: () => void | Promise<void>;
  isPortalActionDisabled?: boolean;
  portalActionTitle?: string;
  isActionLocked?: boolean;
}

export interface Viewport {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface FocusOffset {
  x: number;
  y: number;
}

export interface FocusOffsetState {
  offset: FocusOffset;
  turnKey: string;
}

export interface CellHint {
  direction: MoveDirection;
  kind: HintKind;
  label: string;
}

export interface CellEntity {
  kind: EntityKind;
  label: string;
  token: string;
  accent: string;
  hpRatio: number | null;
  showToken: boolean;
  useWallSurface: boolean;
  badges: EntityCornerBadge[];
  isPortalPromptActive?: boolean;
}

export interface CellActivation {
  kind: "portal" | "pass" | "direction";
  direction?: MoveDirection;
}

export interface MapBoardCellViewModel {
  key: string;
  x: number;
  y: number;
  fog: FogState;
  tile: TileKind;
  entity: CellEntity | null;
  action: CellActivation | null;
  className: string;
  title: string;
  shroomDanger: ShroomTargetTile | null;
}
