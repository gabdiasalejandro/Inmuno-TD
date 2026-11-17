import { describe, expect, it } from 'vitest';
import {
  CANVAS,
  CARD_H,
  ENERGY_COUNTER,
  ENERGY_ICON,
  ENERGY_VALUE,
  FIGURE_TALLEST,
  FIGURE_WIDEST,
  HINT_BUBBLE,
  INTRO_BUTTON,
  INTRO_CARD,
  LEFT_COLUMN,
  LINK_X,
  LINK_Y,
  MARROW_ANCHOR,
  MARROW_CORE,
  MARROW_LABEL,
  MARROW_PANEL,
  MARROW_RING,
  PAUSE_BUTTON,
  PAUSE_PANEL,
  TIMER_RECT,
  TOAST_POS,
  cardAt,
  cardHeight,
  cardRect,
  cardSlots,
  hintTail,
  hudLayout,
  introHit,
  meterChips,
  pauseMenuButtonAt,
  pauseMenuButtons,
  pointInRect,
  resultButtonAt,
  resultButtons,
  type Rect,
} from '../../src/ui/layout';
import { createBoardLayout } from '../../src/game/layout';
import { HUD_FULLSCREEN } from '../../src/ui/fullscreenLayout';

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function insideCanvas(r: Rect): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= CANVAS.w && r.y + r.h <= CANVAS.h;
}

describe('card layout', () => {
  it('makes every card comfortable to tap on a phone', () => {
    expect(cardRect(0).h).toBeGreaterThanOrEqual(96);
    expect(cardRect(0).w).toBeGreaterThanOrEqual(96);
  });

  it('stacks cards in the left column, top to bottom, without overlap', () => {
    const a = cardRect(0);
    const b = cardRect(1);
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.h);
    expect(b.x).toBe(a.x);
    expect(a.x).toBeGreaterThanOrEqual(LEFT_COLUMN.x);
    expect(a.x + a.w).toBeLessThanOrEqual(LEFT_COLUMN.x + LEFT_COLUMN.w);
  });

  it('starts under the marrow panel', () => {
    expect(cardRect(0).y).toBeGreaterThan(MARROW_PANEL.y + MARROW_PANEL.h);
  });

  it('fits up to five cards at full height and shrinks a bigger deck to stay inside the column', () => {
    for (const count of [1, 2, 3, 4, 5]) expect(cardHeight(count)).toBe(CARD_H);
    for (const count of [5, 6, 7]) {
      const last = cardRect(count - 1, count);
      expect(last.y + last.h, `${count} cards`).toBeLessThanOrEqual(LEFT_COLUMN.y + LEFT_COLUMN.h - 8);
      expect(cardRect(1, count).y).toBeGreaterThanOrEqual(cardRect(0, count).y + cardRect(0, count).h);
    }
    expect(cardHeight(6)).toBeLessThan(CARD_H);
    expect(cardHeight(6)).toBeGreaterThanOrEqual(80);
  });

  it('finds the card under a point and ignores gaps and outside points', () => {
    const b = cardRect(1);
    expect(cardAt(b.x + b.w / 2, b.y + b.h / 2, 2)).toBe(1);
    expect(cardAt(b.x + b.w / 2, b.y + b.h / 2, 1)).toBeNull();
    const a = cardRect(0);
    expect(cardAt(a.x + 1, a.y + a.h + 1, 2)).toBeNull();
    expect(cardAt(-10, -10, 2)).toBeNull();
  });
});

describe('card slots', () => {
  const circleRect = (c: { x: number; y: number; r: number }): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

  for (const count of [2, 6]) {
    const { w, h } = cardRect(0, count);
    describe(`card ${w}x${h} (deck of ${count})`, () => {
      const s = cardSlots(w, h);
      const inside = (r: Rect): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
      const parts: Array<[string, Rect]> = [
        ['name', s.name],
        ['badge', circleRect(s.badge)],
        ['figure', s.figureZone],
        ['cost', s.cost],
      ];

      it('keeps every part inside the card', () => {
        for (const [name, r] of parts) expect(inside(r), name).toBe(true);
      });

      it('never overlaps two parts', () => {
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            expect(overlaps(parts[i]![1], parts[j]![1]), `${parts[i]![0]} vs ${parts[j]![0]}`).toBe(false);
          }
        }
      });

      it('scales the widest, tallest figure to fit its zone and stays legible', () => {
        expect(s.figureScale * FIGURE_WIDEST).toBeLessThanOrEqual(s.figureZone.w);
        expect(s.figureScale * FIGURE_TALLEST).toBeLessThanOrEqual(s.figureZone.h);
        expect(s.figureScale).toBeGreaterThanOrEqual(0.22);
        expect(s.figureScale).toBeLessThanOrEqual(0.32);
        expect(s.figureX).toBeGreaterThanOrEqual(s.figureZone.x);
        expect(s.figureX).toBeLessThanOrEqual(s.figureZone.x + s.figureZone.w);
        expect(s.figureGround).toBeLessThanOrEqual(h);
      });

      it('puts the name and the cost in the column right of the figure', () => {
        expect(s.name.x).toBeGreaterThanOrEqual(s.figureZone.x + s.figureZone.w);
        expect(s.cost.x).toBeGreaterThanOrEqual(s.figureZone.x + s.figureZone.w);
        expect(s.badge.r).toBeGreaterThanOrEqual(8);
      });
    });
  }
});

describe('meter chips', () => {
  const layout = hudLayout(3, true);
  const meter = layout.meter as Rect;
  const bar = layout.meterBar as Rect;

  it('fit on the label row of the meter, apart from each other and above the bar', () => {
    const { marrow, recruit } = meterChips(meter, bar);
    for (const chip of [marrow, recruit]) {
      expect(chip.x).toBeGreaterThanOrEqual(meter.x + 94);
      expect(chip.x + chip.w).toBeLessThanOrEqual(bar.x + bar.w);
      expect(chip.y).toBeGreaterThanOrEqual(meter.y);
      expect(chip.y + chip.h).toBeLessThanOrEqual(bar.y);
      expect(chip.w).toBeGreaterThanOrEqual(46);
    }
    expect(overlaps(marrow, recruit)).toBe(false);
  });
});

describe('cytokine hint', () => {
  const board = createBoardLayout(5, 9);

  it('keeps the bubble inside the canvas, over the board, clear of the first lane', () => {
    expect(insideCanvas(HINT_BUBBLE)).toBe(true);
    expect(HINT_BUBBLE.y).toBeGreaterThanOrEqual(board.y + board.cellH);
    expect(HINT_BUBBLE.x).toBeGreaterThanOrEqual(board.x);
  });

  it('points at the meter', () => {
    const meter = hudLayout(3, true).meter as Rect;
    const tail = hintTail(meter);
    expect(tail.tipY).toBeGreaterThanOrEqual(meter.y + meter.h);
    expect(tail.baseX).toBeGreaterThanOrEqual(HINT_BUBBLE.x + 30);
    expect(tail.baseX).toBeLessThanOrEqual(HINT_BUBBLE.x + HINT_BUBBLE.w - 30);
    expect(Math.abs(tail.tipX - (meter.x + meter.w / 2))).toBeLessThanOrEqual(1);
  });

  it('runs the link line in the gaps between the top bar, the left column and the board', () => {
    const board = createBoardLayout(5, 9);
    const meter = hudLayout(3, true).meter as Rect;
    expect(LINK_Y).toBeGreaterThan(meter.y + meter.h);
    expect(LINK_Y).toBeLessThan(board.y);
    expect(LINK_X).toBeGreaterThan(LEFT_COLUMN.x + LEFT_COLUMN.w);
    expect(LINK_X).toBeLessThan(board.x);
  });
});

describe('pointInRect', () => {
  it('is inclusive on the near edge and exclusive on the far edge', () => {
    const r = { x: 10, y: 10, w: 20, h: 20 };
    expect(pointInRect(r, 10, 10)).toBe(true);
    expect(pointInRect(r, 30, 20)).toBe(false);
    expect(pointInRect(r, 9, 15)).toBe(false);
  });

});

describe('left column', () => {
  const board = createBoardLayout(5, 9);

  it('holds the marrow panel and the energy counter, which sits inside the panel', () => {
    expect(insideCanvas(LEFT_COLUMN)).toBe(true);
    expect(LEFT_COLUMN.x + LEFT_COLUMN.w).toBeLessThan(board.x);
    expect(MARROW_PANEL.x >= LEFT_COLUMN.x && MARROW_PANEL.x + MARROW_PANEL.w <= LEFT_COLUMN.x + LEFT_COLUMN.w).toBe(true);
    expect(MARROW_PANEL.y >= LEFT_COLUMN.y).toBe(true);
    expect(MARROW_PANEL.x <= ENERGY_COUNTER.x && ENERGY_COUNTER.x + ENERGY_COUNTER.w <= MARROW_PANEL.x + MARROW_PANEL.w).toBe(true);
    expect(MARROW_PANEL.y <= ENERGY_COUNTER.y && ENERGY_COUNTER.y + ENERGY_COUNTER.h <= MARROW_PANEL.y + MARROW_PANEL.h).toBe(true);
  });

  it('keeps the marrow figure, its ring, its tag and the energy orb and number inside the panel', () => {
    const inPanel = (x: number, y: number, r = 0): boolean =>
      x - r >= MARROW_PANEL.x && x + r <= MARROW_PANEL.x + MARROW_PANEL.w && y - r >= MARROW_PANEL.y && y + r <= MARROW_PANEL.y + MARROW_PANEL.h;
    expect(inPanel(MARROW_RING.x, MARROW_RING.y, MARROW_RING.r)).toBe(true);
    expect(inPanel(MARROW_ANCHOR.x, MARROW_ANCHOR.y)).toBe(true);
    expect(inPanel(MARROW_CORE.x, MARROW_CORE.y)).toBe(true);
    expect(inPanel(MARROW_LABEL.x, MARROW_LABEL.y, 10)).toBe(true);
    expect(inPanel(ENERGY_ICON.x, ENERGY_ICON.y, ENERGY_ICON.r)).toBe(true);
    expect(inPanel(ENERGY_VALUE.x, ENERGY_VALUE.y, 18)).toBe(true);
    // The orb is above the number, and the ring leaves the orb alone.
    expect(ENERGY_ICON.y + ENERGY_ICON.r).toBeLessThan(ENERGY_VALUE.y - 18);
    expect(ENERGY_ICON.x - ENERGY_ICON.r).toBeGreaterThan(MARROW_RING.x + MARROW_RING.r);
  });

  it('places the toast over the board', () => {
    expect(TOAST_POS.x).toBeGreaterThan(board.x);
    expect(TOAST_POS.x).toBeLessThan(board.x + board.cols * board.cellW);
    expect(TOAST_POS.y).toBeGreaterThanOrEqual(board.y);
  });
});

describe('result buttons', () => {
  it('lays out the given actions in order, centred, tappable and without overlap', () => {
    const buttons = resultButtons(['next', 'retry', 'menu']);
    expect(buttons.map((b) => b.action)).toEqual(['next', 'retry', 'menu']);
    const left = buttons[0]!.rect.x;
    const last = buttons[2]!.rect;
    expect(left + (last.x + last.w) ).toBeCloseTo(CANVAS.w, 0);
    for (const { rect } of buttons) {
      expect(insideCanvas(rect)).toBe(true);
      expect(rect.h).toBeGreaterThanOrEqual(72);
    }
    expect(overlaps(buttons[0]!.rect, buttons[1]!.rect)).toBe(false);
    expect(overlaps(buttons[1]!.rect, buttons[2]!.rect)).toBe(false);
  });

  it('finds the action under a point, and null in gaps or outside', () => {
    const buttons = resultButtons(['retry', 'menu']);
    const menu = buttons[1]!.rect;
    expect(resultButtonAt(buttons, menu.x + 5, menu.y + 5)).toBe('menu');
    expect(resultButtonAt(buttons, menu.x - 1, menu.y + 5)).toBeNull();
    expect(resultButtonAt(buttons, 0, 0)).toBeNull();
  });
});

describe('hudLayout', () => {
  const board = createBoardLayout(5, 9);

  for (const cards of [1, 2, 3, 4, 5, 6]) {
    for (const meter of [false, true]) {
      describe(`${cards} cards, meter ${meter}`, () => {
        const layout = hudLayout(cards, meter);
        const bar: Array<[string, Rect]> = [
          ['timer', layout.timer],
          ['inflammation', layout.inflammation],
          ['pause', layout.pause],
          ['fullscreen', HUD_FULLSCREEN],
        ];
        if (layout.meter) bar.push(['meter', layout.meter]);
        const regions: Array<[string, Rect]> = [['marrow', MARROW_PANEL], ...layout.cards.map((r, i): [string, Rect] => [`card${i}`, r]), ...bar];

        it('has the requested number of cards, and a meter and its release button only when asked', () => {
          expect(layout.cards).toHaveLength(cards);
          expect(layout.meter !== null).toBe(meter);
          expect(layout.meterBar !== null).toBe(meter);
          expect(layout.release !== null).toBe(meter);
        });

        it('keeps the cards in the left column and the top bar between the column and the right edge, above the board', () => {
          for (const r of layout.cards) {
            expect(insideCanvas(r)).toBe(true);
            expect(r.x + r.w).toBeLessThanOrEqual(LEFT_COLUMN.x + LEFT_COLUMN.w);
            expect(r.y + r.h).toBeLessThanOrEqual(LEFT_COLUMN.y + LEFT_COLUMN.h);
          }
          for (const [name, r] of bar) {
            expect(insideCanvas(r), name).toBe(true);
            expect(r.x, name).toBeGreaterThanOrEqual(board.x);
            expect(r.y + r.h, name).toBeLessThanOrEqual(board.y);
          }
        });

        it('never overlaps two regions', () => {
          for (let i = 0; i < regions.length; i++) {
            for (let j = i + 1; j < regions.length; j++) {
              expect(overlaps(regions[i]![1], regions[j]![1]), `${regions[i]![0]} vs ${regions[j]![0]}`).toBe(false);
            }
          }
        });

        it('keeps tap targets comfortable and readouts wide enough', () => {
          for (const r of layout.cards) {
            expect(r.w).toBeGreaterThanOrEqual(96);
            expect(r.h).toBeGreaterThanOrEqual(80);
          }
          expect(layout.pause.w).toBeGreaterThanOrEqual(64);
          expect(layout.pause.h).toBeGreaterThanOrEqual(64);
          expect(layout.timer.w).toBeGreaterThanOrEqual(150);
          expect(layout.timer.h).toBeGreaterThanOrEqual(44);
          if (layout.meter) expect(layout.meter.h).toBeGreaterThanOrEqual(44);
          if (layout.release) {
            expect(layout.release.w).toBeGreaterThanOrEqual(96);
            expect(layout.release.h).toBeGreaterThanOrEqual(44);
          }
        });

        it('puts the release button and the meter bar side by side inside the meter panel', () => {
          if (!layout.release || !layout.meter || !layout.meterBar) return;
          for (const r of [layout.release, layout.meterBar]) {
            expect(r.x).toBeGreaterThanOrEqual(layout.meter.x);
            expect(r.x + r.w).toBeLessThanOrEqual(layout.meter.x + layout.meter.w);
            expect(r.y).toBeGreaterThanOrEqual(layout.meter.y);
            expect(r.y + r.h).toBeLessThanOrEqual(layout.meter.y + layout.meter.h);
          }
          expect(layout.meterBar.x + layout.meterBar.w).toBeLessThan(layout.release.x);
          expect(layout.meterBar.w).toBeGreaterThanOrEqual(160);
        });

        it('agrees with cardRect and cardAt', () => {
          layout.cards.forEach((r, i) => {
            expect(r).toEqual(cardRect(i, cards));
            expect(cardAt(r.x + r.w / 2, r.y + r.h / 2, cards)).toBe(i);
          });
        });
      });
    }
  }

  it('leaves the inflammation slot between the meter and the pause button', () => {
    const layout = hudLayout(3, true);
    expect(layout.inflammation.x).toBeGreaterThanOrEqual((layout.meter as Rect).x + (layout.meter as Rect).w);
    expect(layout.inflammation.x + layout.inflammation.w).toBeLessThanOrEqual(layout.pause.x);
    expect(layout.pause).toEqual(PAUSE_BUTTON);
  });

  it('keeps the two-card timer rect exported for the survive levels', () => {
    expect(TIMER_RECT).toEqual(hudLayout(2, false).timer);
  });

  it('puts the pause button left of the fullscreen toggle', () => {
    expect(PAUSE_BUTTON.x + PAUSE_BUTTON.w).toBeLessThanOrEqual(HUD_FULLSCREEN.x);
    expect(PAUSE_BUTTON.y).toBe(HUD_FULLSCREEN.y);
  });
});

describe('pause panel', () => {
  const buttons = pauseMenuButtons(['resume', 'restart', 'menu']);

  it('is centred on the canvas and holds its three buttons, in order, tall enough to tap', () => {
    expect(insideCanvas(PAUSE_PANEL)).toBe(true);
    expect(PAUSE_PANEL.x + PAUSE_PANEL.w / 2).toBe(CANVAS.w / 2);
    expect(buttons.map((b) => b.action)).toEqual(['resume', 'restart', 'menu']);
    for (const { rect } of buttons) {
      expect(rect.x >= PAUSE_PANEL.x && rect.x + rect.w <= PAUSE_PANEL.x + PAUSE_PANEL.w).toBe(true);
      expect(rect.y >= PAUSE_PANEL.y && rect.y + rect.h <= PAUSE_PANEL.y + PAUSE_PANEL.h).toBe(true);
      expect(rect.h).toBeGreaterThanOrEqual(64);
    }
    expect(overlaps(buttons[0]!.rect, buttons[1]!.rect)).toBe(false);
    expect(overlaps(buttons[1]!.rect, buttons[2]!.rect)).toBe(false);
    expect(buttons[1]!.rect.y).toBeGreaterThan(buttons[0]!.rect.y);
  });

  it('finds the button under a point, and null in gaps or outside', () => {
    const restart = buttons[1]!.rect;
    expect(pauseMenuButtonAt(buttons, restart.x + 5, restart.y + 5)).toBe('restart');
    expect(pauseMenuButtonAt(buttons, restart.x + 5, restart.y - 2)).toBeNull();
    expect(pauseMenuButtonAt(buttons, 0, 0)).toBeNull();
    expect(pauseMenuButtonAt([], restart.x + 5, restart.y + 5)).toBeNull();
  });
});

describe('intro card', () => {
  it('fits the canvas with the start button inside the card, big enough to tap', () => {
    expect(insideCanvas(INTRO_CARD)).toBe(true);
    expect(insideCanvas(INTRO_BUTTON)).toBe(true);
    expect(INTRO_BUTTON.x).toBeGreaterThanOrEqual(INTRO_CARD.x);
    expect(INTRO_BUTTON.x + INTRO_BUTTON.w).toBeLessThanOrEqual(INTRO_CARD.x + INTRO_CARD.w);
    expect(INTRO_BUTTON.y + INTRO_BUTTON.h).toBeLessThanOrEqual(INTRO_CARD.y + INTRO_CARD.h);
    expect(INTRO_BUTTON.h).toBeGreaterThanOrEqual(72);
    expect(INTRO_BUTTON.w).toBeGreaterThanOrEqual(200);
  });

  it('starts on a tap on the button or the card, and ignores taps outside', () => {
    expect(introHit(INTRO_BUTTON.x + 5, INTRO_BUTTON.y + 5)).toBe('start');
    expect(introHit(INTRO_CARD.x + 5, INTRO_CARD.y + 5)).toBe('start');
    expect(introHit(INTRO_CARD.x - 1, INTRO_CARD.y + 5)).toBeNull();
    expect(introHit(0, 0)).toBeNull();
  });
});
