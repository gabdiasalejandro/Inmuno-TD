import { describe, expect, it } from 'vitest';
import { CANVAS, ENERGY_COUNTER, INTRO_BUTTON, INTRO_CARD, MARROW_PANEL, MENU_BUTTON, TIMER_RECT, CARD_H, FIGURE_TALLEST, FIGURE_WIDEST, cardAt, cardRect, cardSlots, HINT_BUBBLE, LINK_Y, MARROW_LINK_X, hintTail, meterChips, hudLayout, introHit, pointInRect, resultButtonAt, resultButtons, type Rect } from '../../src/ui/layout';

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

  it('lays cards side by side without overlap', () => {
    const a = cardRect(0);
    const b = cardRect(1);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.w);
    expect(b.y).toBe(a.y);
  });

  it('finds the card under a point and ignores gaps and outside points', () => {
    const b = cardRect(1);
    expect(cardAt(b.x + b.w / 2, b.y + b.h / 2, 2)).toBe(1);
    expect(cardAt(b.x + b.w / 2, b.y + b.h / 2, 1)).toBeNull();
    const a = cardRect(0);
    expect(cardAt(a.x + a.w + 1, a.y + 1, 2)).toBeNull();
    expect(cardAt(-10, -10, 2)).toBeNull();
  });
});

describe('card slots', () => {
  const widths = [1, 2, 3, 4].map((n) => cardRect(0, n).w);
  const circleRect = (c: { x: number; y: number; r: number }): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });
  const inside = (r: Rect, w: number): boolean => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= CARD_H;

  for (const w of widths) {
    describe(`card ${w} wide`, () => {
      const s = cardSlots(w);
      const parts: Array<[string, Rect]> = [
        ['name', s.name],
        ['badge', circleRect(s.badge)],
        ['figure', s.figureZone],
        ['cost', s.cost],
      ];

      it('keeps every part inside the card', () => {
        for (const [name, r] of parts) expect(inside(r, w), name).toBe(true);
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
      });

      it('gives the name the card width less its padding', () => {
        expect(s.name.w).toBeLessThanOrEqual(w - 16);
        expect(s.name.w).toBeGreaterThanOrEqual(w - 24);
      });
    });
  }

  it('keeps the wide-card figure size it had before', () => {
    expect(cardSlots(204).figureScale).toBe(0.32);
  });
});

describe('meter chips', () => {
  for (const cards of [1, 2, 3, 4]) {
    it(`fit on the label row of the meter with ${cards} cards, apart from each other and the bar`, () => {
      const meter = hudLayout(cards, true).meter as Rect;
      const { marrow, recruit } = meterChips(meter);
      for (const chip of [marrow, recruit]) {
        expect(chip.x).toBeGreaterThanOrEqual(meter.x + 94);
        expect(chip.x + chip.w).toBeLessThanOrEqual(meter.x + meter.w - 6);
        expect(chip.y).toBeGreaterThanOrEqual(meter.y);
        // The bar starts 26 px below the top of the meter.
        expect(chip.y + chip.h).toBeLessThanOrEqual(meter.y + 26);
        expect(chip.w).toBeGreaterThanOrEqual(46);
      }
      expect(overlaps(marrow, recruit)).toBe(false);
    });
  }
});

describe('cytokine hint', () => {
  it('keeps the bubble inside the canvas, below the HUD strip and clear of the first lane', () => {
    expect(insideCanvas(HINT_BUBBLE)).toBe(true);
    // The board starts at y 160 and a lane is 108 px high, so the second lane starts at 268.
    expect(HINT_BUBBLE.y).toBeGreaterThanOrEqual(268);
  });

  for (const cards of [1, 2, 3, 4]) {
    it(`points at the meter with ${cards} cards`, () => {
      const meter = hudLayout(cards, true).meter as Rect;
      const tail = hintTail(meter);
      expect(tail.tipY).toBeGreaterThanOrEqual(meter.y + meter.h);
      expect(tail.baseX).toBeGreaterThanOrEqual(HINT_BUBBLE.x + 30);
      expect(tail.baseX).toBeLessThanOrEqual(HINT_BUBBLE.x + HINT_BUBBLE.w - 30);
      expect(Math.abs(tail.tipX - (meter.x + meter.w / 2))).toBeLessThanOrEqual(1);
    });
  }

  it('runs the link line below the HUD strip and above the board', () => {
    expect(LINK_Y).toBeGreaterThan(142);
    expect(LINK_Y).toBeLessThan(160);
    expect(MARROW_LINK_X).toBeGreaterThanOrEqual(MARROW_PANEL.x);
    expect(MARROW_LINK_X).toBeLessThanOrEqual(MARROW_PANEL.x + MARROW_PANEL.w);
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

describe('HUD strip', () => {
  const regions = { marrow: MARROW_PANEL, card0: cardRect(0), card1: cardRect(1), timer: TIMER_RECT, menu: MENU_BUTTON };

  it('keeps every region inside the canvas and above the board', () => {
    for (const r of Object.values(regions)) {
      expect(insideCanvas(r)).toBe(true);
      expect(r.y + r.h).toBeLessThanOrEqual(150);
    }
  });

  it('never overlaps two regions (two-card deck)', () => {
    const list = Object.entries(regions);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        expect(overlaps(list[i]![1], list[j]![1]), `${list[i]![0]} vs ${list[j]![0]}`).toBe(false);
      }
    }
  });

  it('puts the energy counter inside the marrow panel, so producer and counter read as one', () => {
    expect(MARROW_PANEL.x <= ENERGY_COUNTER.x && ENERGY_COUNTER.x + ENERGY_COUNTER.w <= MARROW_PANEL.x + MARROW_PANEL.w).toBe(true);
    expect(MARROW_PANEL.y <= ENERGY_COUNTER.y && ENERGY_COUNTER.y + ENERGY_COUNTER.h <= MARROW_PANEL.y + MARROW_PANEL.h).toBe(true);
  });

  it('makes the menu button comfortable to tap', () => {
    expect(MENU_BUTTON.w).toBeGreaterThanOrEqual(72);
    expect(MENU_BUTTON.h).toBeGreaterThanOrEqual(64);
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
  for (const cards of [1, 2, 3, 4]) {
    for (const meter of [false, true]) {
      describe(`${cards} cards, meter ${meter}`, () => {
        const layout = hudLayout(cards, meter);
        const regions: Array<[string, Rect]> = [
          ['marrow', MARROW_PANEL],
          ...layout.cards.map((r, i): [string, Rect] => [`card${i}`, r]),
          ['timer', layout.timer],
          ['menu', layout.menu],
        ];
        if (layout.meter) regions.push(['meter', layout.meter]);

        it('has the requested number of cards and a meter only when asked', () => {
          expect(layout.cards).toHaveLength(cards);
          expect(layout.meter !== null).toBe(meter);
        });

        it('keeps every region inside the canvas and above the board', () => {
          for (const [name, r] of regions) {
            expect(insideCanvas(r), name).toBe(true);
            expect(r.y + r.h, name).toBeLessThanOrEqual(150);
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
            expect(r.h).toBeGreaterThanOrEqual(96);
          }
          expect(layout.menu.w).toBeGreaterThanOrEqual(72);
          expect(layout.menu.h).toBeGreaterThanOrEqual(64);
          expect(layout.timer.w).toBeGreaterThanOrEqual(150);
          expect(layout.timer.h).toBeGreaterThanOrEqual(44);
          if (layout.meter) expect(layout.meter.h).toBeGreaterThanOrEqual(44);
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

  it('keeps the two-card timer rect exported for the survive levels', () => {
    expect(TIMER_RECT).toEqual(hudLayout(2, false).timer);
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
