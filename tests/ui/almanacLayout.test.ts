import { describe, expect, it } from 'vitest';
import {
  DRAG_THRESHOLD,
  LIST_PANEL,
  LIST_VIEW,
  PAGE_PANEL,
  TILE_COLUMNS,
  TILE_H,
  almanacBackHit,
  clampScroll,
  contentHeight,
  isDrag,
  maxScroll,
  scrollbar,
  tileAt,
  tileRect,
  visibleRange,
  BLOCK_GAP,
  TEXT_W,
  TILE_LABEL,
  pageLayout,
  tileNameFont,
  type PageTexts,
} from '../../src/ui/almanacLayout';
import { ALMANAC_ENTRIES, nameKeys, type AlmanacEntry } from '../../src/ui/almanacModel';
import { t } from '../../src/i18n';
import { estimateTextWidth, wrapLines, wrappedHeight } from '../../src/ui/textFit';
import { CANVAS, pointInRect } from '../../src/ui/layout';

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('almanac layout', () => {
  it('keeps the list and the page inside the canvas and apart from each other', () => {
    for (const panel of [LIST_PANEL, PAGE_PANEL]) {
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.w).toBeLessThanOrEqual(CANVAS.w);
      expect(panel.y + panel.h).toBeLessThanOrEqual(CANVAS.h);
    }
    expect(overlap(LIST_PANEL, PAGE_PANEL)).toBe(false);
  });

  it('fits six tiles inside the list panel without overlap', () => {
    const tiles = Array.from({ length: 6 }, (_, i) => tileRect(i, 0));
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(LIST_PANEL.x);
      expect(tile.x + tile.w).toBeLessThanOrEqual(LIST_PANEL.x + LIST_PANEL.w);
      expect(tile.y).toBeGreaterThanOrEqual(LIST_PANEL.y);
      expect(tile.y + tile.h).toBeLessThanOrEqual(LIST_PANEL.y + LIST_PANEL.h);
    }
    tiles.forEach((a, i) => tiles.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    expect(TILE_COLUMNS).toBe(2);
  });

  it('gives every tile a comfortable tap target', () => {
    for (let i = 0; i < 6; i++) {
      expect(tileRect(i, 0).w).toBeGreaterThanOrEqual(120);
      expect(tileRect(i, 0).h).toBeGreaterThanOrEqual(120);
    }
  });

  it('finds the tile under a point, and none outside', () => {
    for (let i = 0; i < 6; i++) {
      const r = tileRect(i, 0);
      expect(tileAt(r.x + r.w / 2, r.y + r.h / 2, 6, 0)).toBe(i);
    }
    expect(tileAt(5, 5, 6, 0)).toBeNull();
    // A slot past the end of the list is not a tile.
    const r = tileRect(5, 0);
    expect(tileAt(r.x + 1, r.y + 1, 5, 0)).toBeNull();
  });

  it('scrolls: tiles move with the offset and are only hit inside the clipped view', () => {
    const r = tileRect(8, 100);
    expect(r.y).toBe(tileRect(8, 0).y - 100);
    // Visible tile: found at its scrolled position.
    const row3 = tileRect(6, 300);
    expect(tileAt(row3.x + 5, row3.y + 5, 30, 300)).toBe(6);
    // A point on a tile that is scrolled out of the view (above or below it) hits nothing.
    const hidden = tileRect(0, 300);
    expect(tileAt(hidden.x + 5, hidden.y + 5, 30, 300)).toBeNull();
    expect(tileAt(LIST_VIEW.x + 5, LIST_VIEW.y + LIST_VIEW.h + 5, 30, 0)).toBeNull();
  });

  for (const count of [6, 7, 30]) {
    describe(`${count} entries`, () => {
      const rows = Math.ceil(count / TILE_COLUMNS);
      it('measures the content height from the rows', () => {
        expect(contentHeight(count)).toBe(tileRect(count - 1, 0).y + TILE_H + 16 - LIST_VIEW.y);
        expect(contentHeight(count)).toBeGreaterThan(0);
        expect(rows).toBe(Math.ceil(count / 2));
      });

      it('has no scroll range when everything fits, and a range otherwise', () => {
        if (count === 6) expect(maxScroll(count)).toBe(0);
        else expect(maxScroll(count)).toBe(contentHeight(count) - LIST_VIEW.h);
      });

      it('clamps at both ends', () => {
        expect(clampScroll(-50, count)).toBe(0);
        expect(clampScroll(1e6, count)).toBe(maxScroll(count));
        expect(clampScroll(maxScroll(count) / 2, count)).toBe(maxScroll(count) / 2);
      });

      it('shows the last tile fully when scrolled to the end', () => {
        const last = tileRect(count - 1, maxScroll(count));
        expect(last.y + last.h).toBeLessThanOrEqual(LIST_VIEW.y + LIST_VIEW.h);
        expect(last.y).toBeGreaterThanOrEqual(LIST_VIEW.y);
      });

      it('reports a visible range that covers exactly the tiles touching the view', () => {
        for (const offset of [0, maxScroll(count) / 3, maxScroll(count)]) {
          const [first, last] = visibleRange(count, offset);
          for (let i = 0; i < count; i++) {
            const r = tileRect(i, offset);
            const touches = r.y < LIST_VIEW.y + LIST_VIEW.h && r.y + r.h > LIST_VIEW.y;
            expect(i >= first && i <= last, `tile ${i} at offset ${offset}`).toBe(touches);
          }
        }
      });

      it('gives a scrollbar thumb inside the track only when there is something to scroll', () => {
        const bar = scrollbar(count, 0);
        if (count === 6) {
          expect(bar).toBeNull();
          return;
        }
        expect(bar).not.toBeNull();
        const end = scrollbar(count, maxScroll(count))!;
        expect(bar!.y).toBeCloseTo(LIST_VIEW.y, 5);
        expect(end.y + end.h).toBeCloseTo(LIST_VIEW.y + LIST_VIEW.h, 5);
        expect(bar!.h).toBeLessThan(LIST_VIEW.h);
        expect(bar!.h).toBeGreaterThanOrEqual(24);
      });
    });
  }

  it('tells a drag from a tap by distance', () => {
    expect(isDrag(0, DRAG_THRESHOLD - 1)).toBe(false);
    expect(isDrag(0, DRAG_THRESHOLD)).toBe(true);
    expect(isDrag(100, 100 - DRAG_THRESHOLD - 1)).toBe(true);
  });

  it('keeps the scroll view inside the list panel', () => {
    expect(LIST_VIEW.x).toBeGreaterThanOrEqual(LIST_PANEL.x);
    expect(LIST_VIEW.y).toBeGreaterThanOrEqual(LIST_PANEL.y);
    expect(LIST_VIEW.x + LIST_VIEW.w).toBeLessThanOrEqual(LIST_PANEL.x + LIST_PANEL.w);
    expect(LIST_VIEW.y + LIST_VIEW.h).toBeLessThanOrEqual(LIST_PANEL.y + LIST_PANEL.h);
  });

  it('has a back control with a phone-sized tap target', () => {
    expect(almanacBackHit(30, 30)).toBe(true);
    expect(almanacBackHit(700, 400)).toBe(false);
    expect(pointInRect({ x: 0, y: 0, w: 1280, h: 720 }, 30, 30)).toBe(true);
  });
});

describe('almanac text fits its boxes for every entry', () => {
  const name = (entry: AlmanacEntry) => {
    const keys = nameKeys(entry);
    return t(keys.find((key) => t(key) !== key) ?? keys[0]!);
  };
  const texts = (entry: AlmanacEntry): PageTexts => ({
    name: name(entry),
    fact: t(`almanac.${entry.id}.fact`),
    quote: t(`almanac.${entry.id}.quote`),
    note: entry.note ? [t(`almanac.${entry.id}.note_game`), t(`almanac.${entry.id}.note_real`)] : undefined,
  });

  it.each(ALMANAC_ENTRIES.map((entry) => [entry.id, entry] as const))('%s: name on one line, fact and note end above the quote', (_id, entry) => {
    const page = texts(entry);
    const layout = pageLayout(page);
    expect(layout.fits).toBe(true);
    expect(estimateTextWidth(page.name, layout.nameFont, true)).toBeLessThanOrEqual(TEXT_W);
    expect(layout.factY + layout.factH).toBeLessThanOrEqual(layout.quoteTop - BLOCK_GAP);
    if (page.note) {
      expect(layout.noteTop).toBeGreaterThanOrEqual(layout.factY + layout.factH);
      expect(layout.noteTop + layout.noteH).toBeLessThanOrEqual(layout.quoteTop - BLOCK_GAP);
    }
    expect(layout.quoteTop + layout.quoteH).toBeLessThanOrEqual(PAGE_PANEL.y + PAGE_PANEL.h);
  });

  it.each(ALMANAC_ENTRIES.map((entry) => [entry.id, entry] as const))('%s: tile name fits its label strip', (_id, entry) => {
    const label = name(entry);
    const font = tileNameFont(label);
    for (const line of wrapLines(label, TILE_LABEL.w, font, true)) expect(estimateTextWidth(line, font, true)).toBeLessThanOrEqual(TILE_LABEL.w);
    expect(wrappedHeight(label, TILE_LABEL.w, font, 0, true)).toBeLessThanOrEqual(TILE_LABEL.h);
  });

  it('shrinks the page fonts for a long entry instead of overlapping the quote', () => {
    const long = { name: 'Streptococcus pyogenes', fact: 'Dato largo. '.repeat(40), quote: 'Frase.', note: ['Nota del juego.', 'Nota real.'] };
    const layout = pageLayout(long);
    expect(layout.factFont).toBeLessThan(22);
    expect(layout.fits).toBe(true);
  });
});
