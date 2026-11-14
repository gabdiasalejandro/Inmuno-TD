import { pointInRect, type Rect } from './layout';

/**
 * Geometry for the fullscreen toggle in logical canvas pixels (1280x720). Phaser-free so it can
 * be tested headless. The control keeps the same size and glyph in every scene; only its corner
 * changes, because the game HUD already uses the top-right spot for the menu button.
 */

/** Menu and almanac: top right corner, clear of the title and the almanac button. */
export const CANVAS_FULLSCREEN: Rect = { x: 1164, y: 20, w: 104, h: 84 };

/** Game: stacked above the menu button, inside the HUD strip. */
export const HUD_FULLSCREEN: Rect = { x: 1164, y: 10, w: 104, h: 60 };

export interface FullscreenSlots {
  /** Centre of the four-corner glyph. */
  iconX: number;
  iconY: number;
  /** Half extent of the glyph: the corners sit this far from its centre. */
  iconSize: number;
  /** Top of the label, which is anchored to the centre. */
  labelY: number;
  font: number;
}

/** Glyph and label placement inside a button rect; short buttons get a smaller icon and text. */
export function fullscreenSlots(rect: Rect): FullscreenSlots {
  const compact = rect.h < 72;
  return {
    iconX: rect.x + rect.w / 2,
    iconY: rect.y + (compact ? 20 : 30),
    iconSize: compact ? 12 : 16,
    labelY: rect.y + (compact ? 34 : 48),
    font: compact ? 16 : 20,
  };
}

export function fullscreenHit(rect: Rect, x: number, y: number): boolean {
  return pointInRect(rect, x, y);
}
