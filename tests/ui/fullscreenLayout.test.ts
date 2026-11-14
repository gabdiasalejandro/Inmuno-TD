import { describe, expect, it } from 'vitest';
import { CANVAS_FULLSCREEN, HUD_FULLSCREEN, fullscreenHit, fullscreenSlots } from '../../src/ui/fullscreenLayout';
import { CANVAS, MENU_BUTTON, type Rect } from '../../src/ui/layout';
import { ALMANAC_BUTTON } from '../../src/ui/menuLayout';

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function insideCanvas(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= CANVAS.w && r.y + r.h <= CANVAS.h;
}

describe('fullscreen button layout', () => {
  for (const [name, rect, compact] of [
    ['menu and almanac', CANVAS_FULLSCREEN, false],
    ['game HUD', HUD_FULLSCREEN, true],
  ] as const) {
    describe(name, () => {
      it('sits inside the canvas and keeps a phone-sized tap target', () => {
        expect(insideCanvas(rect)).toBe(true);
        expect(rect.w).toBeGreaterThanOrEqual(72);
        expect(rect.h).toBeGreaterThanOrEqual(56);
      });

      it('fits its glyph and label without overflowing the button', () => {
        const slots = fullscreenSlots(rect);
        expect(slots.iconX).toBeGreaterThanOrEqual(rect.x);
        expect(slots.iconX).toBeLessThanOrEqual(rect.x + rect.w);
        expect(slots.iconY - slots.iconSize).toBeGreaterThanOrEqual(rect.y);
        expect(slots.iconY + slots.iconSize).toBeLessThanOrEqual(slots.labelY);
        // One short label line ("Pantalla" at this size) must fit under the glyph.
        expect(slots.labelY + slots.font * 1.4).toBeLessThanOrEqual(rect.y + rect.h);
        expect(slots.font).toBeGreaterThanOrEqual(compact ? 14 : 18);
      });

      it('answers a hit inside only, near edges in and far edges out', () => {
        expect(fullscreenHit(rect, rect.x, rect.y)).toBe(true);
        expect(fullscreenHit(rect, rect.x + rect.w - 1, rect.y + rect.h - 1)).toBe(true);
        expect(fullscreenHit(rect, rect.x + rect.w, rect.y)).toBe(false);
        expect(fullscreenHit(rect, rect.x, rect.y + rect.h)).toBe(false);
        expect(fullscreenHit(rect, -1, -1)).toBe(false);
      });
    });
  }

  it('stacks above the menu button in the game, sharing its column', () => {
    expect(HUD_FULLSCREEN.x).toBe(MENU_BUTTON.x);
    expect(HUD_FULLSCREEN.w).toBe(MENU_BUTTON.w);
    expect(HUD_FULLSCREEN.y + HUD_FULLSCREEN.h).toBeLessThan(MENU_BUTTON.y);
    expect(overlaps(HUD_FULLSCREEN, MENU_BUTTON)).toBe(false);
    // Inside the HUD strip, which ends above the board.
    expect(HUD_FULLSCREEN.y + HUD_FULLSCREEN.h).toBeLessThanOrEqual(150);
  });

  it('sits beside the almanac button on the menu without covering it or the title', () => {
    expect(CANVAS_FULLSCREEN.x).toBeGreaterThan(ALMANAC_BUTTON.x + ALMANAC_BUTTON.w);
    expect(overlaps(CANVAS_FULLSCREEN, ALMANAC_BUTTON)).toBe(false);
    expect(CANVAS_FULLSCREEN.x).toBeGreaterThan(800);
    expect(CANVAS_FULLSCREEN.y + CANVAS_FULLSCREEN.h).toBeLessThanOrEqual(ALMANAC_BUTTON.y + ALMANAC_BUTTON.h);
  });
});
