/** HUD geometry in logical canvas pixels. Phaser-free so it can be tested headless. */

import type { ResultAction } from '../game/flow';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CANVAS: Rect = { x: 0, y: 0, w: 1280, h: 720 };

/** Top-left panel: the bone marrow and, right beside it, the energy it produces. */
export const MARROW_PANEL: Rect = { x: 12, y: 10, w: 300, h: 132 };
/** Foot point of the marrow sprite (bottom centre of its silhouette). */
export const MARROW_ANCHOR = { x: 82, y: 132 };
/** Centre of the marrow cavity, where the next energy batch grows before it flies off. */
export const MARROW_CORE = { x: 82, y: 98 };
/** Charge ring drawn around the whole marrow figure. */
export const MARROW_RING = { x: 82, y: 78, r: 62 };
/** Centre of the name tag hung on the marrow, so the player learns what the character is. */
export const MARROW_LABEL = { x: 82, y: 127 };
export const ENERGY_COUNTER: Rect = { x: 156, y: 22, w: 148, h: 108 };
/** Where flying energy lands: the orb icon of the counter. */
export const ENERGY_ICON = { x: 184, y: 68, r: 17 };

const CARD_X = 330;
const CARD_Y = 18;
export const CARD_H = 112;
const STATUS_GAP = 14;

/** Bottom of the right column: the menu button, under the fullscreen toggle. */
export const MENU_BUTTON: Rect = { x: 1164, y: 78, w: 104, h: 64 };

/** Card width and gap by deck size: a bigger deck gets narrower cards so the strip still fits. */
function cardMetrics(count: number): { w: number; gap: number } {
  if (count <= 2) return { w: 204, gap: 14 };
  if (count === 3) return { w: 172, gap: 14 };
  return { w: 140, gap: 10 };
}

/** Card `index` of a deck of `count` cards (a deck of two by default). */
export function cardRect(index: number, count = 2): Rect {
  const { w, gap } = cardMetrics(count);
  return { x: CARD_X + index * (w + gap), y: CARD_Y, w, h: CARD_H };
}

/** Unscaled silhouette size of the biggest card character (the macrophage is the widest). */
export const FIGURE_WIDEST = 230;
export const FIGURE_TALLEST = 200;
const FIGURE_MAX_SCALE = 0.32;
const CARD_PAD = 8;
const NAME_H = 26;
/** Cost row: orb (radius 10) left of a number of up to three digits. */
const COST_ORB_SPAN = 26;
const COST_H = 28;
const COST_RIGHT = 10;

export interface CardSlots {
  /** Name strip: the label is centred in it and shrinks to fit its width. */
  name: Rect;
  /** Boost badge, in the right column between the name and the cost, free at every card width. */
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
  const cost: Rect = { x: w - COST_RIGHT - costW, y: h - 26 - COST_H / 2, w: costW, h: COST_H };
  const figureGround = h - 12;
  const top = CARD_PAD + NAME_H;
  const figureZone: Rect = { x: 6, y: top, w: cost.x - 4 - 6, h: figureGround - top };
  const figureScale = Math.min(FIGURE_MAX_SCALE, figureZone.w / FIGURE_WIDEST, figureZone.h / FIGURE_TALLEST);
  return {
    name: { x: CARD_PAD, y: 6, w: w - CARD_PAD * 2, h: NAME_H },
    badge: { x: w - 20, y: 52, r: 14 },
    figureZone,
    figureX: figureZone.x + figureZone.w / 2,
    figureGround,
    figureScale,
    cost,
    costFont,
  };
}

export interface HudLayout {
  cards: Rect[];
  /** Countdown or bacteria counter. */
  timer: Rect;
  /** Cytokine meter, stacked under the timer; null in levels without the signal. */
  meter: Rect | null;
  menu: Rect;
}

/**
 * Everything right of the marrow panel: the cards, then one status column (timer, plus the
 * cytokine meter below it when `hasMeter`), then the menu button.
 */
export function hudLayout(cardCount: number, hasMeter: boolean): HudLayout {
  const cards = Array.from({ length: cardCount }, (_, i) => cardRect(i, cardCount));
  const last = cards[cards.length - 1];
  const x = (last ? last.x + last.w : CARD_X) + STATUS_GAP;
  const w = MENU_BUTTON.x - STATUS_GAP - x;
  const top = 22;
  const height = 104;
  if (!hasMeter) return { cards, timer: { x, y: top, w, h: height }, meter: null, menu: MENU_BUTTON };
  const half = 48;
  return {
    cards,
    timer: { x, y: top, w, h: half },
    meter: { x, y: top + height - half, w, h: half },
    menu: MENU_BUTTON,
  };
}

/** Width reserved on the meter's label row for the word "Citocinas". */
const METER_LABEL_W = 94;

/**
 * Two small effect chips on the meter's label row, right of its label and above the bar
 * (the bar starts 26 px below the meter's top): marrow speed first, redeploy speed second.
 */
export function meterChips(meter: Rect): { marrow: Rect; recruit: Rect } {
  const gap = 4;
  const left = meter.x + METER_LABEL_W;
  const w = Math.min(64, Math.floor((meter.x + meter.w - 8 - left - gap) / 2));
  const y = meter.y + 3;
  return {
    marrow: { x: left, y, w, h: 20 },
    recruit: { x: left + w + gap, y, w, h: 20 },
  };
}

/**
 * Speech bubble that explains the meter: it sits in the second lane of the board (the first one
 * is where the fight starts) and its tail reaches up to the meter, narrow enough to leave lane 1 usable.
 */
export const HINT_BUBBLE: Rect = { x: 620, y: 272, w: 560, h: 104 };

export function hintTail(meter: Rect): { tipX: number; tipY: number; baseX: number; baseY: number } {
  const tipX = meter.x + meter.w / 2;
  return {
    tipX,
    tipY: meter.y + meter.h + 4,
    baseX: Math.min(Math.max(tipX, HINT_BUBBLE.x + 40), HINT_BUBBLE.x + HINT_BUBBLE.w - 40),
    baseY: HINT_BUBBLE.y,
  };
}

/** Thin link line under the HUD strip, from the marrow panel to the meter and the sped-up cards. */
export const LINK_Y = 148;
export const MARROW_LINK_X = 160;

export const TIMER_RECT: Rect = hudLayout(2, false).timer;

/** Half-open: near edges are inside, far edges are outside. */
export function pointInRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** Index of the card under a point, or null. */
export function cardAt(x: number, y: number, count: number): number | null {
  for (let i = 0; i < count; i++) {
    if (pointInRect(cardRect(i, count), x, y)) return i;
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
