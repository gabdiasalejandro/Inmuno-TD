import { pointInRect, type Rect } from './layout';

/** Almanac geometry in logical canvas pixels (1280x720). Phaser-free so it can be tested headless. */

/** Back control, top left (same spot as the level view's). */
export const ALMANAC_BACK: Rect = { x: 24, y: 20, w: 200, h: 84 };
export const TITLE_POS = { x: 640, y: 20 };

/** Left: the grid of entries. Right: the selected entry's page. */
export const LIST_PANEL: Rect = { x: 24, y: 124, w: 424, h: 572 };
export const PAGE_PANEL: Rect = { x: 468, y: 124, w: 788, h: 572 };

/** The scrolling window onto the entries; everything drawn in the list is clipped to it. */
export const LIST_VIEW: Rect = LIST_PANEL;

export const TILE_COLUMNS = 2;
const TILE_GAP = 14;
const TILE_PAD = 16;
export const TILE_W = (LIST_PANEL.w - TILE_PAD * 2 - TILE_GAP) / TILE_COLUMNS;
export const TILE_H = 170;
/** Finger or pointer travel (logical px) from which a press becomes a drag instead of a tap. */
export const DRAG_THRESHOLD = 10;

/** Tile `index` with the list scrolled down by `offset` (0 = top). */
export function tileRect(index: number, offset = 0): Rect {
  const col = index % TILE_COLUMNS;
  const row = Math.floor(index / TILE_COLUMNS);
  return {
    x: LIST_VIEW.x + TILE_PAD + col * (TILE_W + TILE_GAP),
    y: LIST_VIEW.y + TILE_PAD + row * (TILE_H + TILE_GAP) - offset,
    w: TILE_W,
    h: TILE_H,
  };
}

/** Total height of the list content, padding included. */
export function contentHeight(count: number): number {
  const rows = Math.ceil(count / TILE_COLUMNS);
  if (rows === 0) return 0;
  return TILE_PAD * 2 + rows * TILE_H + (rows - 1) * TILE_GAP;
}

/** Largest scroll offset: 0 when everything fits. */
export function maxScroll(count: number): number {
  return Math.max(0, contentHeight(count) - LIST_VIEW.h);
}

export function clampScroll(offset: number, count: number): number {
  return Math.min(Math.max(offset, 0), maxScroll(count));
}

/** Inclusive indices of the tiles that touch the view at this offset; [0, -1] when there are none. */
export function visibleRange(count: number, offset: number): [number, number] {
  if (count === 0) return [0, -1];
  const rowH = TILE_H + TILE_GAP;
  const top = offset - TILE_PAD;
  const bottom = offset + LIST_VIEW.h - TILE_PAD;
  const firstRow = Math.max(0, Math.floor((top - TILE_H) / rowH) + 1);
  const lastRow = Math.floor((bottom - 1) / rowH);
  const first = firstRow * TILE_COLUMNS;
  const last = Math.min(count - 1, (lastRow + 1) * TILE_COLUMNS - 1);
  // Rows are only visible when the tile itself (not just its gap) overlaps; trim exact misses.
  let lo = first;
  while (lo <= last && !touches(lo, offset)) lo++;
  let hi = last;
  while (hi >= lo && !touches(hi, offset)) hi--;
  return lo > hi ? [0, -1] : [lo, hi];
}

function touches(index: number, offset: number): boolean {
  const r = tileRect(index, offset);
  return r.y < LIST_VIEW.y + LIST_VIEW.h && r.y + r.h > LIST_VIEW.y;
}

/** Tile under a point at this scroll offset. Points outside the clipped view hit nothing. */
export function tileAt(x: number, y: number, count: number, offset: number): number | null {
  if (!pointInRect(LIST_VIEW, x, y)) return null;
  for (let i = 0; i < count; i++) {
    if (pointInRect(tileRect(i, offset), x, y)) return i;
  }
  return null;
}

/** True once the pointer has travelled far enough from where it went down to count as a drag. */
export function isDrag(startY: number, y: number): boolean {
  return Math.abs(y - startY) >= DRAG_THRESHOLD;
}

/** Slim scroll indicator along the right edge of the view; null when nothing scrolls. */
export function scrollbar(count: number, offset: number): Rect | null {
  const max = maxScroll(count);
  if (max <= 0) return null;
  const h = Math.max(24, (LIST_VIEW.h * LIST_VIEW.h) / contentHeight(count));
  const y = LIST_VIEW.y + (clampScroll(offset, count) / max) * (LIST_VIEW.h - h);
  return { x: LIST_VIEW.x + LIST_VIEW.w - 11, y, w: 5, h };
}

export function almanacBackHit(x: number, y: number): boolean {
  return pointInRect(ALMANAC_BACK, x, y);
}

/** Page contents (absolute coordinates). Figure stage on the left, name/chip/fact on the right. */
export const STAGE: Rect = { x: 488, y: 144, w: 250, h: 262 };
export const TEXT_X = 760;
export const TEXT_W = 476;
/** Note and quote areas run the full width of the page, inside its padding. */
export const BODY_X = 488;
export const BODY_W = 748;
export const PAGE_BOTTOM = PAGE_PANEL.y + PAGE_PANEL.h - 16;
