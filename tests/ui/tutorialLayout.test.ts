import { describe, expect, it } from 'vitest';
import { CANVAS, LEFT_COLUMN, MARROW_PANEL, arrowDirection, arrowZone, cardRect, hudLayout, pointInRect, rectsOverlap, tutorialLayout, type Rect } from '../../src/ui/layout';

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

describe('tutorialLayout', () => {
  it('puts the bubble in the high slot, beside the marrow, when nothing is in the way', () => {
    expect(tutorialLayout(null).side).toBe('high');
    // A top-bar target far right of the bubble: neither it nor its arrow reach the high slot.
    expect(tutorialLayout(hudLayout(4, true).inflammation).side).toBe('high');
  });

  it('moves the bubble lower when the arrow under a top-bar target would cover the high slot', () => {
    const release = hudLayout(4, true).release!;
    expect(arrowDirection(release)).toBe('up');
    // The release button itself ends above the high slot; only its arrow reaches into it.
    expect(rectsOverlap(tutorialLayout(null).zone, release)).toBe(false);
    const layout = tutorialLayout(release);
    expect(layout.side).toBe('low');
    expect(rectsOverlap(layout.zone, arrowZone(release))).toBe(false);
    expect(tutorialLayout(hudLayout(4, true).meter!).side).toBe('low');
  });

  it('moves the bubble lower when the arrow pointing at the marrow would cross the high slot', () => {
    const layout = tutorialLayout(MARROW_PANEL);
    expect(layout.side).toBe('low');
    expect(rectsOverlap(layout.zone, arrowZone(MARROW_PANEL))).toBe(false);
  });

  it('moves the bubble lower on the board when the target is where the high slot would be', () => {
    const highCell: Rect = { x: 327, y: 96, w: 111, h: 120 };
    expect(tutorialLayout(highCell).side).toBe('low');
  });

  it('never covers the macrophage cell of tutorial 1-3 (row 2, col 6)', () => {
    const cell: Rect = { x: 327 + 6 * 111, y: 96 + 2 * 120, w: 111, h: 120 };
    expect(rectsOverlap(tutorialLayout(cell).zone, cell)).toBe(false);
  });

  it('moves the bubble when any one of several targets would be covered', () => {
    const far: Rect = { x: 900, y: 500, w: 50, h: 50 };
    const highCell: Rect = { x: 327, y: 96, w: 111, h: 120 };
    expect(tutorialLayout([far, far]).side).toBe('high');
    expect(tutorialLayout([far, highCell]).side).toBe('low');
  });

  it.each(['high', 'low'] as const)('keeps bubble, next button and tail inside the canvas and its zone (%s)', (side) => {
    const layout = tutorialLayout(side === 'high' ? null : { x: 300, y: 100, w: 50, h: 50 });
    expect(layout.side).toBe(side);
    expect(inside(layout.bubble, CANVAS)).toBe(true);
    expect(inside(layout.bubble, layout.zone)).toBe(true);
    expect(inside(layout.next, layout.bubble)).toBe(true);
    expect(pointInRect(layout.zone, layout.tail.tipX, layout.tail.tipY)).toBe(true);
    expect(pointInRect(layout.zone, layout.tail.baseX, layout.tail.baseY)).toBe(true);
  });

  it('keeps the tail on the bubble edge and its tip toward the marrow panel', () => {
    const { bubble, tail } = tutorialLayout(null);
    expect(tail.baseX).toBe(bubble.x);
    expect(tail.baseY).toBeGreaterThan(bubble.y);
    expect(tail.baseY).toBeLessThan(bubble.y + bubble.h);
    expect(tail.tipX).toBeLessThan(bubble.x);
    expect(tail.tipX).toBeLessThanOrEqual(MARROW_PANEL.x + MARROW_PANEL.w);
    // High slot: the tip lands within the marrow panel's height.
    expect(tail.tipY).toBeGreaterThanOrEqual(MARROW_PANEL.y);
    expect(tail.tipY).toBeLessThanOrEqual(MARROW_PANEL.y + MARROW_PANEL.h);
  });

  it('keeps both slots clear of the left column, so the bubble never hides a card', () => {
    for (const target of [null, { x: 327, y: 96, w: 111, h: 120 }]) {
      const { bubble } = tutorialLayout(target);
      expect(bubble.x).toBeGreaterThanOrEqual(LEFT_COLUMN.x + LEFT_COLUMN.w);
    }
  });

  it('does not cover the wound breach column', () => {
    const breach: Rect = { x: 1215, y: 96, w: 60, h: 120 };
    expect(rectsOverlap(tutorialLayout(breach).zone, breach)).toBe(false);
  });
});

describe('rectsOverlap', () => {
  it('is false for rects that only touch', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
});

describe('arrowDirection', () => {
  it('comes from the board for the left column, from below for the top bar, from the left for a breach and from above elsewhere', () => {
    expect(arrowDirection(MARROW_PANEL)).toBe('left');
    expect(arrowDirection(cardRect(2, 3))).toBe('left');
    expect(arrowDirection(hudLayout(3, true).meter as Rect)).toBe('up');
    expect(arrowDirection(hudLayout(3, true).release as Rect)).toBe('up');
    expect(arrowDirection({ x: 1215, y: 96, w: 60, h: 120 })).toBe('right');
    // A cell of the first lane has the top bar above it; any other lane is open above.
    expect(arrowDirection({ x: 549, y: 96, w: 111, h: 120 })).toBe('up');
    expect(arrowDirection({ x: 549, y: 336, w: 111, h: 120 })).toBe('down');
  });
});
