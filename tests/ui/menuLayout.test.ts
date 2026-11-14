import { describe, expect, it } from 'vitest';
import {
  ALMANAC_BUTTON,
  BACK_BUTTON,
  LEVEL_COUNT_MAX,
  LEVEL_HIT_RADIUS,
  NEXT_LEVEL_BUTTON,
  WORLD_COUNT,
  WORLD_HIT_RADIUS,
  almanacHit,
  backHit,
  levelAt,
  levelLabelSide,
  levelPos,
  nextLevelHit,
  routePoints,
  worldAt,
  worldLabelSide,
  worldPos,
} from '../../src/ui/menuLayout';
import { CANVAS_FULLSCREEN } from '../../src/ui/fullscreenLayout';

const W = 1280;
const H = 720;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('world map layout', () => {
  it('keeps every world, with its hit area, inside the logical canvas', () => {
    for (let i = 0; i < WORLD_COUNT; i++) {
      const p = worldPos(i);
      expect(p.x - WORLD_HIT_RADIUS).toBeGreaterThanOrEqual(0);
      expect(p.x + WORLD_HIT_RADIUS).toBeLessThanOrEqual(W);
      expect(p.y - WORLD_HIT_RADIUS).toBeGreaterThanOrEqual(0);
      expect(p.y + WORLD_HIT_RADIUS).toBeLessThanOrEqual(H);
    }
  });

  it('lays the worlds out left to right as one journey, without overlapping hit areas', () => {
    for (let i = 1; i < WORLD_COUNT; i++) {
      expect(worldPos(i).x).toBeGreaterThan(worldPos(i - 1).x);
      expect(dist(worldPos(i), worldPos(i - 1))).toBeGreaterThan(2 * WORLD_HIT_RADIUS);
    }
  });

  it('makes every world tall enough to tap on a phone in landscape', () => {
    // 844x390 scales the 1280x720 canvas by about 0.54: 44 css px needs about 82 logical px.
    expect(2 * WORLD_HIT_RADIUS).toBeGreaterThanOrEqual(82);
  });

  it('puts the label on the free side of each world so labels never meet the next world', () => {
    for (let i = 1; i < WORLD_COUNT; i++) {
      expect(worldLabelSide(i)).not.toBe(worldLabelSide(i - 1));
    }
    // Upper worlds label above, lower worlds label below.
    for (let i = 0; i < WORLD_COUNT; i++) {
      const centre = worldPos(i).y;
      expect(worldLabelSide(i)).toBe(centre < H / 2 ? 'above' : 'below');
    }
  });

  it('finds the world under a point and ignores gaps, outside points and out-of-range worlds', () => {
    const p = worldPos(3);
    expect(worldAt(p.x, p.y, WORLD_COUNT)).toBe(3);
    expect(worldAt(p.x + WORLD_HIT_RADIUS - 2, p.y, WORLD_COUNT)).toBe(3);
    expect(worldAt(p.x + WORLD_HIT_RADIUS + 2, p.y, WORLD_COUNT)).toBeNull();
    expect(worldAt(p.x, p.y, 3)).toBeNull();
    expect(worldAt(0, 0, WORLD_COUNT)).toBeNull();
  });
});

describe('level path layout', () => {
  it('keeps every node of every list length inside the canvas, centred and ordered', () => {
    for (let count = 1; count <= LEVEL_COUNT_MAX; count++) {
      for (let i = 0; i < count; i++) {
        const p = levelPos(i, count);
        expect(p.x - LEVEL_HIT_RADIUS).toBeGreaterThanOrEqual(0);
        expect(p.x + LEVEL_HIT_RADIUS).toBeLessThanOrEqual(W);
        expect(p.y - LEVEL_HIT_RADIUS).toBeGreaterThanOrEqual(0);
        expect(p.y + LEVEL_HIT_RADIUS).toBeLessThanOrEqual(H);
        if (i > 0) {
          expect(p.x).toBeGreaterThan(levelPos(i - 1, count).x);
          expect(dist(p, levelPos(i - 1, count))).toBeGreaterThan(2 * LEVEL_HIT_RADIUS);
        }
      }
      expect((levelPos(0, count).x + levelPos(count - 1, count).x) / 2).toBeCloseTo(W / 2, 5);
    }
  });

  it('makes every node tall enough to tap on a phone in landscape', () => {
    expect(2 * LEVEL_HIT_RADIUS).toBeGreaterThanOrEqual(82);
  });

  it('alternates the label side so neighbouring titles never collide', () => {
    for (let i = 1; i < LEVEL_COUNT_MAX; i++) {
      expect(levelLabelSide(i)).not.toBe(levelLabelSide(i - 1));
    }
  });

  it('finds the node under a point and ignores gaps, outside points and out-of-range nodes', () => {
    const p = levelPos(2, 8);
    expect(levelAt(p.x, p.y, 8)).toBe(2);
    expect(levelAt(p.x, p.y, 2)).toBeNull();
    expect(levelAt(p.x + LEVEL_HIT_RADIUS + 2, p.y, 8)).toBeNull();
    expect(levelAt(0, 0, 8)).toBeNull();
    expect(levelAt(p.x, p.y, 0)).toBeNull();
  });
});

describe('back control', () => {
  it('sits inside the canvas and is big enough to tap on a phone in landscape', () => {
    expect(BACK_BUTTON.x).toBeGreaterThanOrEqual(0);
    expect(BACK_BUTTON.y).toBeGreaterThanOrEqual(0);
    expect(BACK_BUTTON.x + BACK_BUTTON.w).toBeLessThanOrEqual(W);
    expect(BACK_BUTTON.h).toBeGreaterThanOrEqual(82);
  });

  it('hits inside the control only, near edges in and far edges out', () => {
    expect(backHit(BACK_BUTTON.x, BACK_BUTTON.y)).toBe(true);
    expect(backHit(BACK_BUTTON.x + BACK_BUTTON.w, BACK_BUTTON.y)).toBe(false);
    expect(backHit(BACK_BUTTON.x + 5, BACK_BUTTON.y + BACK_BUTTON.h + 5)).toBe(false);
    expect(backHit(W / 2, H / 2)).toBe(false);
  });

  it('never overlaps a level node for any list length', () => {
    for (let count = 1; count <= LEVEL_COUNT_MAX; count++) {
      for (let i = 0; i < count; i++) {
        const p = levelPos(i, count);
        expect(levelAt(p.x, p.y, count)).toBe(i);
        expect(backHit(p.x, p.y)).toBe(false);
      }
    }
  });
});

describe('routePoints', () => {
  const pts = [
    { x: 100, y: 300 },
    { x: 300, y: 450 },
    { x: 500, y: 300 },
    { x: 700, y: 450 },
  ];

  it('passes through every control point and keeps its ends', () => {
    const r = routePoints(pts, 8);
    expect(r).toHaveLength((pts.length - 1) * 8 + 1);
    pts.forEach((p, i) => {
      const q = r[i * 8]!;
      expect(q.x).toBeCloseTo(p.x, 6);
      expect(q.y).toBeCloseTo(p.y, 6);
    });
  });

  it('winds between the points instead of drawing straight segments', () => {
    const r = routePoints(pts, 8);
    const mid = r[4]!;
    const straight = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
    expect(dist(mid, straight)).toBeGreaterThan(1);
  });

  it('copes with fewer than two points', () => {
    expect(routePoints([], 8)).toEqual([]);
    expect(routePoints([{ x: 1, y: 2 }], 8)).toEqual([{ x: 1, y: 2 }]);
  });
});

describe('almanac button on the world map', () => {
  it('sits inside the canvas and clear of the title and every world', () => {
    const b = ALMANAC_BUTTON;
    expect(b.x + b.w).toBeLessThanOrEqual(W);
    expect(b.y + b.h).toBeLessThanOrEqual(H);
    expect(b.x).toBeGreaterThan(TITLE_RIGHT);
    for (let i = 0; i < WORLD_COUNT; i++) {
      const p = worldPos(i);
      const nearestX = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const nearestY = Math.max(b.y, Math.min(p.y, b.y + b.h));
      expect(Math.hypot(p.x - nearestX, p.y - nearestY)).toBeGreaterThan(WORLD_HIT_RADIUS);
    }
  });

  it('hits inside and misses outside', () => {
    expect(almanacHit(ALMANAC_BUTTON.x + 5, ALMANAC_BUTTON.y + 5)).toBe(true);
    expect(almanacHit(640, 400)).toBe(false);
  });

  it('is a phone-sized tap target', () => {
    expect(ALMANAC_BUTTON.h).toBeGreaterThanOrEqual(80);
  });
});

const TITLE_RIGHT = 800;

describe('next level shortcut on the world map', () => {
  it('sits inside the canvas, clear of the title and of every world', () => {
    const b = NEXT_LEVEL_BUTTON;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(W);
    expect(b.y + b.h).toBeLessThanOrEqual(H);
    expect(b.x + b.w).toBeLessThan(TITLE_RIGHT);
    for (let i = 0; i < WORLD_COUNT; i++) {
      const p = worldPos(i);
      const nearestX = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const nearestY = Math.max(b.y, Math.min(p.y, b.y + b.h));
      expect(Math.hypot(p.x - nearestX, p.y - nearestY)).toBeGreaterThan(WORLD_HIT_RADIUS);
    }
  });

  it('leaves the almanac and fullscreen controls their own corner', () => {
    expect(NEXT_LEVEL_BUTTON.x + NEXT_LEVEL_BUTTON.w).toBeLessThan(ALMANAC_BUTTON.x);
    expect(NEXT_LEVEL_BUTTON.x + NEXT_LEVEL_BUTTON.w).toBeLessThan(CANVAS_FULLSCREEN.x);
  });

  it('is a phone-sized tap target and hits inside only', () => {
    expect(NEXT_LEVEL_BUTTON.h).toBeGreaterThanOrEqual(82);
    expect(nextLevelHit(NEXT_LEVEL_BUTTON.x + 5, NEXT_LEVEL_BUTTON.y + 5)).toBe(true);
    expect(nextLevelHit(NEXT_LEVEL_BUTTON.x + NEXT_LEVEL_BUTTON.w, NEXT_LEVEL_BUTTON.y)).toBe(false);
    expect(nextLevelHit(NEXT_LEVEL_BUTTON.x, NEXT_LEVEL_BUTTON.y + NEXT_LEVEL_BUTTON.h)).toBe(false);
    expect(nextLevelHit(W / 2, H / 2)).toBe(false);
  });
});
