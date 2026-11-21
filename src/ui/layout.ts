/** HUD geometry in logical canvas pixels. Phaser-free so it can be tested headless. */

import type { ResultAction } from '../game/flow';
import type { PauseAction } from '../game/pause';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CANVAS: Rect = { x: 0, y: 0, w: 1280, h: 720 };

/**
 * Left column (PvZ 2 style): the bone marrow with its energy counter on top, the deck as a
 * vertical stack of cards under it. The top bar and the board sit to its right.
 */
export const LEFT_COLUMN: Rect = { x: 8, y: 8, w: 196, h: 704 };

/** Marrow panel: the bone marrow figure on the left and, right beside it, the energy it produces. */
export const MARROW_PANEL: Rect = { x: 18, y: 18, w: 176, h: 128 };
/** Scale of the marrow figure inside its panel. */
export const MARROW_FIGURE_SCALE = 0.5;
/** Foot point of the marrow sprite (bottom centre of its silhouette). */
export const MARROW_ANCHOR = { x: 70, y: 119 };
/** Centre of the marrow cavity, where the next energy batch grows before it flies off. */
export const MARROW_CORE = { x: 70, y: 93 };
/** Charge ring drawn around the whole marrow figure. */
export const MARROW_RING = { x: 70, y: 76, r: 48 };
/** Centre of the name tag hung on the marrow, so the player learns what the character is. */
export const MARROW_LABEL = { x: 70, y: 133 };
export const ENERGY_COUNTER: Rect = { x: 108, y: 26, w: 82, h: 112 };
/** Where flying energy lands: the orb icon of the counter. */
export const ENERGY_ICON = { x: 138, y: 62, r: 16 };
/** Centre of the energy number, under the orb. */
export const ENERGY_VALUE = { x: 152, y: 104 };

const CARD_X = 18;
const CARD_TOP = 160;
/** Lowest y a card may reach (the column's bottom edge less its padding). */
const CARD_BOTTOM = 704;
const CARD_W = 176;
const CARD_GAP = 8;
/** Card height of a deck that fits the column (up to five cards). */
export const CARD_H = 96;
const CARDS_FIT = 5;

/** Lowest y the deck's cards may reach when powers sit under them. */
const CARD_BOTTOM_WITH_POWERS = 552;
/** The powers' own section: below the deck, never mixed with its cards. */
const POWER_TOP = 566;
const POWER_BOTTOM = 704;
const POWER_H = 138;

/** Card height by deck size: five cards fit at full height, a bigger deck shrinks them to fit the column. */
export function cardHeight(count: number, powerCount = 0): number {
  const bottom = powerCount > 0 ? CARD_BOTTOM_WITH_POWERS : CARD_BOTTOM;
  const fit = Math.floor((bottom - CARD_TOP - (count - 1) * CARD_GAP) / count);
  return count <= CARDS_FIT ? Math.min(CARD_H, fit) : fit;
}

/** Card `index` of a deck of `count` cards (a deck of two by default). */
export function cardRect(index: number, count = 2, powerCount = 0): Rect {
  const h = cardHeight(count, powerCount);
  return { x: CARD_X, y: CARD_TOP + index * (h + CARD_GAP), w: CARD_W, h };
}

/** Power `index` of `count` powers, stacked in their own section under the deck. */
export function powerRect(index: number, count: number): Rect {
  const h = Math.min(POWER_H, Math.floor((POWER_BOTTOM - POWER_TOP - (count - 1) * CARD_GAP) / count));
  return { x: CARD_X, y: POWER_TOP + index * (h + CARD_GAP), w: CARD_W, h };
}

/** Unscaled silhouette size of the biggest card character (the macrophage is the widest). */
export const FIGURE_WIDEST = 230;
export const FIGURE_TALLEST = 200;
const FIGURE_MAX_SCALE = 0.32;
const CARD_PAD = 8;
const NAME_H = 24;
/** The figure takes the left part of the card; name, badge and cost share the right part. */
const FIGURE_W = 64;
const RIGHT_X = CARD_PAD + FIGURE_W + 8;
/** Cost row: orb (radius 10) left of a number of up to three digits. */
const COST_ORB_SPAN = 26;
const COST_H = 28;
const COST_RIGHT = 10;
const BADGE_R = 14;

export interface CardSlots {
  /** Name strip: the label is centred in it and shrinks to fit its width. */
  name: Rect;
  /** Boost badge, in the right column between the name and the cost. */
  badge: { x: number; y: number; r: number };
  /** Where the character stands; it is scaled so its widest and tallest possible silhouette fit. */
  figureZone: Rect;
  figureX: number;
  /** Ground point of the figure, relative to the card top. */
  figureGround: number;
  figureScale: number;
  /** Orb plus up to three digits, right-aligned. */
  cost: Rect;
  costFont: number;
}

/** Positions of the parts of one card, relative to its top-left corner. */
export function cardSlots(w: number, h = CARD_H): CardSlots {
  const costFont = w < 150 ? 20 : 24;
  const costW = Math.ceil(3 * 0.6 * costFont) + COST_ORB_SPAN;
  const cost: Rect = { x: w - COST_RIGHT - costW, y: h - CARD_PAD - COST_H, w: costW, h: COST_H };
  const name: Rect = { x: RIGHT_X, y: 6, w: w - RIGHT_X - CARD_PAD, h: NAME_H };
  const figureGround = h - 10;
  const figureZone: Rect = { x: CARD_PAD, y: CARD_PAD, w: FIGURE_W, h: figureGround - CARD_PAD };
  const figureScale = Math.min(FIGURE_MAX_SCALE, figureZone.w / FIGURE_WIDEST, figureZone.h / FIGURE_TALLEST);
  const bandTop = name.y + name.h;
  const band = cost.y - bandTop;
  const r = Math.min(BADGE_R, Math.floor((band - 2) / 2));
  return {
    name,
    badge: { x: w - 20, y: bandTop + band / 2, r },
    figureZone,
    figureX: figureZone.x + figureZone.w / 2,
    figureGround,
    figureScale,
    cost,
    costFont,
  };
}

/** Top bar: every panel is this high and starts this far from the top edge. */
const BAR_Y = 14;
const BAR_H = 68;
const BAR_X = 216;
const BAR_GAP = 14;
const TIMER_W = 250;
const METER_W = 420;
const INFLAMMATION_W = 190;
const BUTTON_W = 68;
/** Width of the hold-to-release button, which sits inside the meter panel. */
const RELEASE_W = 148;
const RELEASE_INSET = 12;

/** Pause button: top right of the bar, left of the fullscreen toggle. */
export const PAUSE_BUTTON: Rect = { x: 1118, y: BAR_Y, w: BUTTON_W, h: BAR_H };

export interface HudLayout {
  cards: Rect[];
  /** The powers' section under the deck, one rectangle per power. */
  powers: Rect[];
  /** Level progress (clear levels) or countdown (timed levels). */
  timer: Rect;
  /** Cytokine meter panel, beside the timer; null in levels without the signal. */
  meter: Rect | null;
  /** The meter's own bar, inside the panel left of the release button; null without the meter. */
  meterBar: Rect | null;
  /** Hold-to-release button, inside the meter panel at its right; null without the meter. */
  release: Rect | null;
  /** Slot kept free for the future inflammation meter (nothing is drawn there yet). */
  inflammation: Rect;
  pause: Rect;
}

/**
 * The left column's cards and the top bar: timer, then the cytokine meter with its release
 * button when `hasMeter`, the reserved inflammation slot, and the pause button.
 */
export function hudLayout(cardCount: number, hasMeter: boolean, powerCount = 0): HudLayout {
  const cards = Array.from({ length: cardCount }, (_, i) => cardRect(i, cardCount, powerCount));
  const powers = Array.from({ length: powerCount }, (_, i) => powerRect(i, powerCount));
  const timer: Rect = { x: BAR_X, y: BAR_Y, w: TIMER_W, h: BAR_H };
  const inflammation: Rect = { x: PAUSE_BUTTON.x - BAR_GAP - INFLAMMATION_W, y: BAR_Y, w: INFLAMMATION_W, h: BAR_H };
  if (!hasMeter) return { cards, powers, timer, meter: null, meterBar: null, release: null, inflammation, pause: PAUSE_BUTTON };
  const meter: Rect = { x: timer.x + timer.w + BAR_GAP, y: BAR_Y, w: METER_W, h: BAR_H };
  const release: Rect = { x: meter.x + meter.w - RELEASE_INSET - RELEASE_W, y: meter.y + 8, w: RELEASE_W, h: meter.h - 16 };
  const barX = meter.x + 16;
  const meterBar: Rect = { x: barX, y: meter.y + 38, w: release.x - 14 - barX, h: 16 };
  return { cards, powers, timer, meter, meterBar, release, inflammation, pause: PAUSE_BUTTON };
}

/** Width reserved on the meter's label row for the word "Citocinas". */
const METER_LABEL_W = 94;

/**
 * Two small effect chips on the meter's label row, right of its label and above the bar:
 * marrow speed first, redeploy speed second.
 */
export function meterChips(meter: Rect, bar: Rect): { marrow: Rect; recruit: Rect } {
  const gap = 4;
  const left = meter.x + METER_LABEL_W;
  const w = Math.min(64, Math.floor((bar.x + bar.w - left - gap) / 2));
  const y = meter.y + 5;
  return {
    marrow: { x: left, y, w, h: 20 },
    recruit: { x: left + w + gap, y, w, h: 20 },
  };
}

/**
 * Speech bubble that explains the meter: it sits in the second lane of the board (the first one
 * is where the fight starts) and its tail reaches up to the meter, narrow enough to leave lane 1 usable.
 */
export const HINT_BUBBLE: Rect = { x: 600, y: 228, w: 560, h: 104 };

export function hintTail(meter: Rect): { tipX: number; tipY: number; baseX: number; baseY: number } {
  const tipX = meter.x + meter.w / 2;
  return {
    tipX,
    tipY: meter.y + meter.h + 4,
    baseX: Math.min(Math.max(tipX, HINT_BUBBLE.x + 40), HINT_BUBBLE.x + HINT_BUBBLE.w - 40),
    baseY: HINT_BUBBLE.y,
  };
}

/**
 * Thin link line in the gap between the top bar and the board (`LINK_Y`) and down the gap between
 * the left column and the board (`LINK_X`): it ties the meter to the marrow and the sped-up cards.
 */
export const LINK_Y = 89;
export const LINK_X = 211;

/** Where the "not enough energy" style toast appears: over the top lane, centred on the board. */
export const TOAST_POS = { x: 715, y: 150 };

export const TIMER_RECT: Rect = hudLayout(2, false).timer;

/** Half-open: near edges are inside, far edges are outside. */
export function pointInRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** Index of the card under a point, or null. */
export function cardAt(x: number, y: number, count: number, powerCount = 0): number | null {
  for (let i = 0; i < count; i++) {
    if (pointInRect(cardRect(i, count, powerCount), x, y)) return i;
  }
  return null;
}

/** Index of the power under a point, or null. */
export function powerAt(x: number, y: number, count: number): number | null {
  for (let i = 0; i < count; i++) {
    if (pointInRect(powerRect(i, count), x, y)) return i;
  }
  return null;
}

/** Result overlay panel, centred on the canvas. */
export const RESULT_PANEL: Rect = { x: 290, y: 150, w: 700, h: 430 };

const RESULT_BUTTON_W = 200;
const RESULT_BUTTON_H = 84;
const RESULT_BUTTON_GAP = 22;
const RESULT_BUTTON_Y = 468;

export interface ResultButton {
  action: ResultAction;
  rect: Rect;
}

/** One row of buttons, in the given order, centred horizontally on the canvas. */
export function resultButtons(actions: ResultAction[]): ResultButton[] {
  const total = actions.length * RESULT_BUTTON_W + Math.max(0, actions.length - 1) * RESULT_BUTTON_GAP;
  const left = (CANVAS.w - total) / 2;
  return actions.map((action, i) => ({
    action,
    rect: { x: left + i * (RESULT_BUTTON_W + RESULT_BUTTON_GAP), y: RESULT_BUTTON_Y, w: RESULT_BUTTON_W, h: RESULT_BUTTON_H },
  }));
}

export function resultButtonAt(buttons: ResultButton[], x: number, y: number): ResultAction | null {
  return buttons.find((b) => pointInRect(b.rect, x, y))?.action ?? null;
}

/** Concept card shown before a level: the whole card is the tap target, the button is its focus. */
export const INTRO_CARD: Rect = { x: 170, y: 40, w: 940, h: 650 };
export const INTRO_BUTTON: Rect = { x: 460, y: 586, w: 360, h: 86 };

/** 'start' for a tap anywhere on the card, null outside it. */
export function introHit(x: number, y: number): 'start' | null {
  return pointInRect(INTRO_CARD, x, y) ? 'start' : null;
}

/**
 * Tutorial tutor: the bone marrow in the left column talks, its speech bubble comes out to the
 * right of that column in one of two slots, so it can dodge what the arrow points at.
 */
export type TutorialSide = 'high' | 'low';

export interface TutorialLayout {
  side: TutorialSide;
  /** Speech bubble. */
  bubble: Rect;
  /** Tail of the bubble: its base on the bubble's left edge and its tip, towards the marrow. */
  tail: { baseX: number; baseY: number; tipX: number; tipY: number };
  /** "Siguiente" button, inside the bubble; only drawn for tap-to-continue steps. */
  next: Rect;
  /** Everything the slot covers: bubble plus tail. */
  zone: Rect;
}

/** Tall enough for three lines of text above the "Siguiente" row, so the button never covers words. */
const TUTORIAL_BUBBLE = { x: LEFT_COLUMN.x + LEFT_COLUMN.w + 20, w: 680, h: 170 };
const TUTORIAL_BUBBLE_Y: Record<TutorialSide, number> = { high: 96, low: 460 };
const TUTORIAL_NEXT = { w: 132, h: 40 };
const TUTORIAL_TAIL_LENGTH = 30;

function tutorialSlot(side: TutorialSide): TutorialLayout {
  const bubble: Rect = { x: TUTORIAL_BUBBLE.x, y: TUTORIAL_BUBBLE_Y[side], w: TUTORIAL_BUBBLE.w, h: TUTORIAL_BUBBLE.h };
  const baseY = bubble.y + 30;
  const marrowY = MARROW_PANEL.y + MARROW_PANEL.h / 2;
  // The tip leans towards the marrow centre, but never more than a stubby tail's worth.
  const tipY = baseY + Math.max(-70, Math.min(12, marrowY - baseY));
  const tipX = bubble.x - TUTORIAL_TAIL_LENGTH;
  return {
    side,
    bubble,
    tail: { baseX: bubble.x, baseY, tipX, tipY },
    next: { x: bubble.x + bubble.w - TUTORIAL_NEXT.w - 14, y: bubble.y + bubble.h - TUTORIAL_NEXT.h - 12, w: TUTORIAL_NEXT.w, h: TUTORIAL_NEXT.h },
    zone: { x: tipX, y: Math.min(bubble.y, tipY), w: bubble.w + TUTORIAL_TAIL_LENGTH, h: bubble.h + Math.max(0, bubble.y - tipY) },
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The bubble sits beside the marrow unless that would cover one of the `targets` (the things it
 * highlights) or the arrow that points at the first of them.
 */
export function tutorialLayout(targets: Rect | readonly Rect[] | null): TutorialLayout {
  const list = targets === null ? [] : 'x' in targets ? [targets] : targets;
  const first = list[0];
  const covered = first ? [...list, arrowZone(first)] : [];
  const high = tutorialSlot('high');
  return covered.some((rect) => rectsOverlap(high.zone, rect)) ? tutorialSlot('low') : high;
}

export type ArrowDirection = 'up' | 'down' | 'right' | 'left';

/** A target centred left of this x is in the left column, so the arrow comes from the board at its right. */
const LEFT_EDGE_X = 210;
/** Past this x a target hugs the right edge (a wound's breach), so the arrow comes from its left. */
const RIGHT_EDGE_X = 1150;
/** A target centred above this y is in the top bar or the first lane: the arrow comes from below. */
const TOP_ROW_Y = 216;

/** Which way a tutorial arrow points at `target`, chosen so it comes from open space. */
export function arrowDirection(target: Rect): ArrowDirection {
  const cx = target.x + target.w / 2;
  if (cx < LEFT_EDGE_X) return 'left';
  if (cx > RIGHT_EDGE_X) return 'right';
  return target.y + target.h / 2 < TOP_ROW_Y ? 'up' : 'down';
}

/** Size of the tutorial arrow: shaft length, half its head's width, how far it bobs, and its widest gap to the target. */
export const TUTORIAL_ARROW = { length: 62, halfWidth: 24, bob: 10, gap: 13 } as const;

/** Space the tutorial arrow pointing at `target` can take up, bob included. */
export function arrowZone(target: Rect): Rect {
  const { length, halfWidth, bob, gap } = TUTORIAL_ARROW;
  const reach = gap + bob + length;
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  switch (arrowDirection(target)) {
    case 'down':
      return { x: cx - halfWidth, y: target.y - reach, w: halfWidth * 2, h: reach };
    case 'up':
      return { x: cx - halfWidth, y: target.y + target.h, w: halfWidth * 2, h: reach };
    case 'right':
      return { x: target.x - reach, y: cy - halfWidth, w: reach, h: halfWidth * 2 };
    case 'left':
      return { x: target.x + target.w, y: cy - halfWidth, w: reach, h: halfWidth * 2 };
  }
}

/** Pause panel, centred on the canvas, with its three buttons stacked under the title. */
export const PAUSE_PANEL: Rect = { x: 410, y: 160, w: 460, h: 400 };
/** Centre of the panel's title. */
export const PAUSE_TITLE = { x: 640, y: 216 };

const PAUSE_BUTTON_W = 320;
const PAUSE_BUTTON_H = 72;
const PAUSE_BUTTON_GAP = 18;
const PAUSE_BUTTONS_Y = 272;

export interface PauseMenuButton {
  action: PauseAction;
  rect: Rect;
}

/** The pause panel's buttons, top to bottom, in the order of `actions`. */
export function pauseMenuButtons(actions: readonly PauseAction[]): PauseMenuButton[] {
  return actions.map((action, i) => ({
    action,
    rect: {
      x: PAUSE_PANEL.x + (PAUSE_PANEL.w - PAUSE_BUTTON_W) / 2,
      y: PAUSE_BUTTONS_Y + i * (PAUSE_BUTTON_H + PAUSE_BUTTON_GAP),
      w: PAUSE_BUTTON_W,
      h: PAUSE_BUTTON_H,
    },
  }));
}

export function pauseMenuButtonAt(buttons: readonly PauseMenuButton[], x: number, y: number): PauseAction | null {
  return buttons.find((b) => pointInRect(b.rect, x, y))?.action ?? null;
}
