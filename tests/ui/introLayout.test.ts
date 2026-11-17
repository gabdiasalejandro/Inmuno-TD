import { describe, expect, it } from 'vitest';
import { levelIntros } from '../../src/data';
import { t } from '../../src/i18n';
import { introLayout, type IntroLayout } from '../../src/ui/introLayout';
import { INTRO_BUTTON, INTRO_CARD, type Rect } from '../../src/ui/layout';
import { BODY_LINE_SPACING } from '../../src/ui/introLayout';
import { estimateTextWidth, wrapLines, wrappedHeight } from '../../src/ui/textFit';

/** Same lookup as the card: a unit name, or an enemy name when there is no unit with that id. */
function characterName(id: string): string {
  const unit = t(`unit.${id}.name`);
  return unit !== `unit.${id}.name` ? unit : t(`enemy.${id}.name`);
}

const overlapX = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w;

function expectFits(layout: IntroLayout, names: readonly string[], body: string): void {
  layout.features.forEach((feature, i) => {
    const { name } = feature;
    // The label box holds the whole name at its font and stays inside the card.
    expect(estimateTextWidth(names[i]!, feature.font, true)).toBeLessThanOrEqual(name.w + 0.5);
    expect(name.x).toBeGreaterThanOrEqual(INTRO_CARD.x);
    expect(name.x + name.w).toBeLessThanOrEqual(INTRO_CARD.x + INTRO_CARD.w);
    for (const other of layout.features.slice(i + 1)) expect(overlapX(name, other.name)).toBe(false);
  });
  const { body: box, bodyFont } = layout;
  expect(box.y).toBeGreaterThanOrEqual(Math.max(...layout.features.map((f) => f.name.y + f.name.h)));
  for (const line of wrapLines(body, box.w, bodyFont)) expect(estimateTextWidth(line, bodyFont)).toBeLessThanOrEqual(box.w);
  expect(box.y + wrappedHeight(body, box.w, bodyFont, BODY_LINE_SPACING)).toBeLessThanOrEqual(box.y + box.h);
  expect(box.y + box.h).toBeLessThan(INTRO_BUTTON.y);
}

describe('intro card layout', () => {
  it.each(Object.entries(levelIntros))('level %s: names never collide and the text ends above the button', (_id, intro) => {
    const names = intro.feature.map(characterName);
    const body = t(intro.body);
    expectFits(introLayout(names, body), names, body);
  });

  it('keeps the body at a readable size in every level', () => {
    for (const intro of Object.values(levelIntros)) {
      const names = intro.feature.map(characterName);
      expect(introLayout(names, t(intro.body)).bodyFont).toBeGreaterThanOrEqual(22);
    }
  });

  it('spaces a long name away from its neighbour instead of using a fixed step', () => {
    const layout = introLayout(['Neutrófilo', 'Streptococcus pyogenes'], 'x');
    expect(overlapX(layout.features[0]!.name, layout.features[1]!.name)).toBe(false);
    expect(layout.nameFont).toBe(30);
  });

  it('shrinks the names when a row of long ones would not fit the card', () => {
    const names = ['Streptococcus pyogenes', 'Staphylococcus aureus', 'Mycobacterium tuberculosis'];
    const layout = introLayout(names, 'x');
    expect(layout.nameFont).toBeLessThan(30);
    expectFits(layout, names, 'x');
  });

  it('shrinks a long body until it ends above the button', () => {
    const body = 'Una frase bastante larga sobre inmunología que se repite. '.repeat(5);
    const layout = introLayout(['Macrófago'], body);
    expect(layout.bodyFont).toBeLessThan(29);
    expectFits(layout, ['Macrófago'], body);
  });
});
