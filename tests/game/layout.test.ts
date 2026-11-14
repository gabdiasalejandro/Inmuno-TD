import { describe, expect, it } from 'vitest';
import { cellCenter, createBoardLayout, enemyFrontX, isCellFree, pixelToCell } from '../../src/game/layout';

const layout = createBoardLayout(5, 9);

describe('board layout', () => {
  it('fits the whole grid inside the 1280x720 canvas below the HUD strip', () => {
    expect(layout.x).toBeGreaterThanOrEqual(0);
    expect(layout.x + layout.cols * layout.cellW).toBeLessThanOrEqual(1280);
    expect(layout.y).toBeGreaterThanOrEqual(140);
    expect(layout.y + layout.rows * layout.cellH).toBeLessThanOrEqual(720);
  });

  it('maps a cell to its center and back to the same cell', () => {
    for (const [row, col] of [[0, 0], [2, 4], [4, 8], [1, 7]] as const) {
      const { x, y } = cellCenter(layout, row, col);
      expect(pixelToCell(layout, x, y)).toEqual({ row, col });
    }
  });

  it('treats the top-left corner as inside and the far edges as outside', () => {
    expect(pixelToCell(layout, layout.x, layout.y)).toEqual({ row: 0, col: 0 });
    expect(pixelToCell(layout, layout.x + layout.cols * layout.cellW, layout.y)).toBeNull();
    expect(pixelToCell(layout, layout.x, layout.y + layout.rows * layout.cellH)).toBeNull();
  });

  it('returns null for points outside the board', () => {
    expect(pixelToCell(layout, layout.x - 1, layout.y + 10)).toBeNull();
    expect(pixelToCell(layout, layout.x + 10, layout.y - 1)).toBeNull();
    expect(pixelToCell(layout, -500, -500)).toBeNull();
    expect(pixelToCell(layout, 5000, 5000)).toBeNull();
    expect(pixelToCell(layout, Number.NaN, 100)).toBeNull();
  });

  it('places enemy positions (thousandths of a cell) on the grid x axis', () => {
    expect(enemyFrontX(layout, 0)).toBe(layout.x);
    expect(enemyFrontX(layout, 9000)).toBe(layout.x + 9 * layout.cellW);
    expect(enemyFrontX(layout, 1500)).toBeCloseTo(layout.x + 1.5 * layout.cellW);
  });
});

describe('isCellFree', () => {
  it('is false only for a cell some unit already occupies', () => {
    const units = [{ row: 2, col: 3 }, { row: 0, col: 0 }];
    expect(isCellFree(units, { row: 2, col: 3 })).toBe(false);
    expect(isCellFree(units, { row: 3, col: 2 })).toBe(true);
    expect(isCellFree([], { row: 0, col: 0 })).toBe(true);
  });
});
