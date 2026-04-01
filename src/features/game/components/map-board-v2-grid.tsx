import type { MouseEvent } from "react";

import type { MapBoardCellViewModel } from "./map-board-v2.types";

interface MapBoardV2GridProps {
  cells: MapBoardCellViewModel[];
  columnCount: number;
  onActivateCell: (cell: MapBoardCellViewModel) => void;
  onSelectCell: (key: string) => void;
}

export function MapBoardV2Grid({
  cells,
  columnCount,
  onActivateCell,
  onSelectCell,
}: MapBoardV2GridProps) {
  function handleContextMenu(event: MouseEvent<HTMLButtonElement>, key: string) {
    event.preventDefault();
    onSelectCell(key);
  }

  return (
    <div className="map2-grid" style={{ gridTemplateColumns: `repeat(${columnCount}, var(--map2-cell-size, 56px))` }}>
      {cells.map((cell) => (
        <button
          key={cell.key}
          type="button"
          className={cell.className}
          onClick={() => onActivateCell(cell)}
          onContextMenu={(event) => handleContextMenu(event, cell.key)}
          title={cell.title}
        >
          <span className="map2-cell-base" />
          {cell.fog !== "hidden" ? <span className="map2-cell-pattern" /> : null}
          {cell.entity && cell.entity.showToken && cell.fog !== "hidden" ? (
            <span className="map2-token">
              <span className="map2-token-core">{cell.entity.token}</span>
            </span>
          ) : null}
          {cell.entity && cell.fog !== "hidden"
            ? cell.entity.badges.map((badge) => (
                <span
                  key={`${badge.position}:${badge.text}`}
                  className={`map2-token-badge map2-token-badge-${badge.position} map2-token-badge-${badge.tone}`}
                >
                  {badge.text}
                </span>
              ))
            : null}
        </button>
      ))}
    </div>
  );
}
