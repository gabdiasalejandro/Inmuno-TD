import { pointInRect, type Rect } from './layout';
import type { Difficulty } from '../data';

/** Menu geometry in logical canvas pixels (1280x720). Phaser-free so it can be tested headless. */

export const WORLD_COUNT = 8;
export const LEVEL_COUNT_MAX = 8;

export interface Point {
  x: number;
  y: number;
}

export type LabelSide = 'above' | 'below';

export const TITLE_POS = { x: 640, y: 14 };
export const CAPTION_POS = { x: 640, y: 76 };

/** Worlds zigzag along one journey: upper stops label above, lower stops label below. */
const WORLD_X0 = 140;
const WORLD_DX = 142.857;
const WORLD_Y_UPPER = 290;
const WORLD_Y_LOWER = 480;
export const WORLD_SIZE = 128;
export const WORLD_HIT_RADIUS = 72;

export function worldPos(index: number): Point {
  return { x: WORLD_X0 + index * WORLD_DX, y: index % 2 === 0 ? WORLD_Y_UPPER : WORLD_Y_LOWER };
}

export function worldLabelSide(index: number): LabelSide {
  return index % 2 === 0 ? 'above' : 'below';
}

/** Level nodes follow the same zigzag, centred on the canvas whatever the list length. */
const LEVEL_DX = 140;
const LEVEL_Y_UPPER = 340;
const LEVEL_Y_LOWER = 470;
export const LEVEL_NODE_SIZE = 92;
export const LEVEL_HIT_RADIUS = 48;

export function levelPos(index: number, count: number): Point {
  return { x: 640 + (index - (count - 1) / 2) * LEVEL_DX, y: index % 2 === 0 ? LEVEL_Y_UPPER : LEVEL_Y_LOWER };
}

export function levelLabelSide(index: number): LabelSide {
  return index % 2 === 0 ? 'above' : 'below';
}

/** Back control of the level view, top left. */
export const BACK_BUTTON: Rect = { x: 24, y: 20, w: 200, h: 84 };

export function backHit(x: number, y: number): boolean {
  return pointInRect(BACK_BUTTON, x, y);
}

/** World map only: primary shortcut straight into the next level to play. */
export const NEXT_LEVEL_BUTTON: Rect = { x: 24, y: 20, w: 320, h: 84 };

export function nextLevelHit(x: number, y: number): boolean {
  return pointInRect(NEXT_LEVEL_BUTTON, x, y);
}

/** Almanac button of the world map, top right beside the fullscreen toggle. */
export const ALMANAC_BUTTON: Rect = { x: 890, y: 20, w: 260, h: 84 };

export function almanacHit(x: number, y: number): boolean {
  return pointInRect(ALMANAC_BUTTON, x, y);
}

function nodeAt(pos: (i: number) => Point, radius: number, x: number, y: number, count: number): number | null {
  for (let i = 0; i < count; i++) {
    const p = pos(i);
    if (Math.hypot(x - p.x, y - p.y) <= radius) return i;
  }
  return null;
}

export function worldAt(x: number, y: number, count: number): number | null {
  return nodeAt(worldPos, WORLD_HIT_RADIUS, x, y, count);
}

export function levelAt(x: number, y: number, count: number): number | null {
  return nodeAt((i) => levelPos(i, count), LEVEL_HIT_RADIUS, x, y, count);
}

/** Catmull-Rom spline through the points: `perSegment` samples per gap, endpoints included. */
export function routePoints(points: readonly Point[], perSegment: number): Point[] {
  if (points.length < 2) return points.map((p) => ({ ...p }));
  const out: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      out.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t), y: catmull(p0.y, p1.y, p2.y, p3.y, t) });
    }
  }
  out.push({ ...points[points.length - 1]! });
  return out;
}

function catmull(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

/**
 * Difficulty selector, bottom right of the map and of every level path (clear of the world labels): two halves, Normal on
 * the left and Sepsis on the right. Phaser-free like the rest of the layout.
 */
export const DIFFICULTY_BUTTON: Rect = { x: 900, y: 640, w: 356, h: 64 };

export function difficultyAt(x: number, y: number): Difficulty | null {
  if (!pointInRect(DIFFICULTY_BUTTON, x, y)) return null;
  return x < DIFFICULTY_BUTTON.x + DIFFICULTY_BUTTON.w / 2 ? 'normal' : 'sepsis';
}
