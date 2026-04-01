import type { MapBoardV2Props } from "./map-board-v2.types";
import { MapBoardV2Grid } from "./map-board-v2-grid";
import { MapBoardV2Sidebar } from "./map-board-v2-sidebar";
import { useMapBoardV2Model } from "./use-map-board-v2-model";

export function MapBoardV2({
  gameState,
  moveEvents = [],
  portalPrompt = null,
  onDirectionalAction,
  onPassAction,
  onPortalAction,
  isPortalActionDisabled = false,
  portalActionTitle,
  isActionLocked = false,
}: MapBoardV2Props) {
  const model = useMapBoardV2Model({
    gameState,
    moveEvents,
    portalPrompt,
    onDirectionalAction,
    onPassAction,
    onPortalAction,
    isPortalActionDisabled,
    isActionLocked,
  });

  if (!model.hasMapData) {
    return <p>No map data available.</p>;
  }

  return (
    <div className="map2-shell">
      <div className="map2-controls">
        <div className="map2-control-stack">
          <div className="map2-segmented">
            <button type="button" onClick={() => model.setFocusMode("focus")} disabled={model.viewMode === "focus"}>
              Focus
            </button>
            <button type="button" onClick={() => model.setFocusMode("full")} disabled={model.viewMode === "full"}>
              Full
            </button>
          </div>

          {model.viewMode === "focus" ? (
            <>
              <div className="map2-toolbar">
                <button type="button" onClick={model.zoomIn} title="Zoom in">
                  -
                </button>
                <button type="button" className="map2-toolbar-value" disabled title="Focus window">
                  {model.focusWindowSize}x{model.focusWindowSize}
                </button>
                <button type="button" onClick={model.zoomOut} title="Zoom out">
                  +
                </button>
                <button type="button" onClick={model.resetFocusOffset} title="Center on player">
                  Reset
                </button>
              </div>

              <div className="map2-dpad">
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => model.panFocus(0, -2)} title="Pan up">
                  Up
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => model.panFocus(-2, 0)} title="Pan left">
                  Left
                </button>
                <button type="button" onClick={model.resetFocusOffset} title="Reset focus center">
                  Home
                </button>
                <button type="button" onClick={() => model.panFocus(2, 0)} title="Pan right">
                  Right
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
                <button type="button" onClick={() => model.panFocus(0, 2)} title="Pan down">
                  Down
                </button>
                <button type="button" className="map2-dpad-spacer" disabled aria-hidden="true" />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="map2-stage">
        <div className="map2-board">
          <MapBoardV2Grid
            cells={model.cells}
            columnCount={model.columnCount}
            onActivateCell={model.handleActivateCell}
            onSelectCell={model.handleSelectCell}
          />
        </div>

        <MapBoardV2Sidebar model={model} portalActionTitle={portalActionTitle} />
      </div>
    </div>
  );
}
