/** Board geometry in logical canvas pixels. Phaser-free so it can be tested headless. */

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/** Vertical space reserved at the top for the HUD strip. */
const BOARD_TOP = 160;
const BOARD_MARGIN_X = 64;
const BOARD_MARGIN_BOTTOM = 20;

/** Enemy `pos` values are thousandths of a cell. */
const POS_PER_CELL = 1000;

export interface BoardLayout {
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  rows: number;
  cols: number;
}

export interface Cell {
  row: number;
  col: number;
}

export function createBoardLayout(rows: number, cols: number): BoardLayout {
  return {
    x: BOARD_MARGIN_X,
    y: BOARD_TOP,
    cellW: Math.floor((CANVAS_WIDTH - 2 * BOARD_MARGIN_X) / cols),
    cellH: Math.floor((CANVAS_HEIGHT - BOARD_TOP - BOARD_MARGIN_BOTTOM) / rows),
    rows,
    cols,
  };
}

export function cellCenter(layout: BoardLayout, row: number, col: number): { x: number; y: number } {
  return {
    x: layout.x + (col + 0.5) * layout.cellW,
    y: layout.y + (row + 0.5) * layout.cellH,
  };
}

/** The cell under a point, or null when the point is outside the board (or not a number). */
export function pixelToCell(layout: BoardLayout, x: number, y: number): Cell | null {
  const col = Math.floor((x - layout.x) / layout.cellW);
  const row = Math.floor((y - layout.y) / layout.cellH);
  if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
  if (col < 0 || col >= layout.cols || row < 0 || row >= layout.rows) return null;
  return { row, col };
}

/** Pixel x of an enemy's front edge given the sim position. */
export function enemyFrontX(layout: BoardLayout, pos: number): number {
  return layout.x + (pos / POS_PER_CELL) * layout.cellW;
}

export function boardRight(layout: BoardLayout): number {
  return layout.x + layout.cols * layout.cellW;
}

/** Whether no unit stands on `cell`. Mirrors the sim's occupancy rule, for placement previews only. */
export function isCellFree(units: ReadonlyArray<Cell>, cell: Cell): boolean {
  return !units.some((unit) => unit.row === cell.row && unit.col === cell.col);
}
