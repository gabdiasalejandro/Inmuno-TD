/** Geometry of the concept card shown before a level. Phaser-free so it can be tested headless. */

import { INTRO_BUTTON, INTRO_CARD, type Rect } from './layout';
import { estimateTextWidth, fitLineFont, fitWrappedFont, lineHeight } from './textFit';

/** Ground line the characters stand on. */
export const FEATURE_FOOT_Y = 350;
/** Room each character needs at least, whatever its name (the widest figure at the card's scale). */
const FIGURE_SLOT = 240;
/** Free space kept between two neighbouring name labels. */
const NAME_GAP = 40;
const NAME_FONT = 30;
const NAME_FONT_MIN = 20;
const NAME_TOP = FEATURE_FOOT_Y + 20;
const SIDE_PAD = 40;

export const BODY_FONT = 29;
export const BODY_FONT_MIN = 20;
export const BODY_LINE_SPACING = 4;
const BODY_SIDE = 60;
/** Space kept between the names and the body, and between the body and the start button. */
const BODY_MARGIN = 16;

export interface FeatureSlot {
  /** Centre of the character and of its name. */
  x: number;
  /** Font size of the name label. */
  font: number;
  /** Name label box; the label is centred in it and must not grow past its width. */
  name: Rect;
}

export interface IntroLayout {
  features: FeatureSlot[];
  nameFont: number;
  /** Width of the soft ground disc under the characters. */
  groundW: number;
  /** Box the body text is wrapped to and must end inside (above the start button). */
  body: Rect;
  bodyFont: number;
}

/**
 * Places the featured characters so their names never collide (each slot is as wide as its name,
 * the whole row shrinking its font when it would not fit the card) and fits the body text, by
 * shrinking its font, into the space between the names and the start button.
 */
export function introLayout(names: readonly string[], body: string): IntroLayout {
  const cx = INTRO_CARD.x + INTRO_CARD.w / 2;
  const available = INTRO_CARD.w - SIDE_PAD * 2;
  const rowWidth = (font: number) => names.reduce((sum, name) => sum + Math.max(FIGURE_SLOT, estimateTextWidth(name, font, true) + NAME_GAP), 0);

  let nameFont = NAME_FONT;
  while (nameFont > NAME_FONT_MIN && rowWidth(nameFont) > available) nameFont--;
  // Past the smallest font the slots split the row evenly and each name shrinks to its own slot.
  const even = rowWidth(nameFont) > available;
  const slotWidths = names.map((name) => (even ? available / names.length : Math.max(FIGURE_SLOT, estimateTextWidth(name, nameFont, true) + NAME_GAP)));
  const total = slotWidths.reduce((sum, w) => sum + w, 0);

  const nameH = lineHeight(nameFont);
  let left = cx - total / 2;
  const features = slotWidths.map((w, i) => {
    const x = left + w / 2;
    left += w;
    const labelW = w - NAME_GAP;
    const font = even ? fitLineFont(names[i]!, labelW, nameFont, NAME_FONT_MIN / 2, true) : nameFont;
    const textW = Math.min(labelW, estimateTextWidth(names[i]!, font, true));
    return { x, font, name: { x: x - textW / 2, y: NAME_TOP, w: textW, h: nameH } };
  });

  const top = NAME_TOP + nameH + BODY_MARGIN;
  const bodyRect: Rect = { x: INTRO_CARD.x + BODY_SIDE, y: top, w: INTRO_CARD.w - BODY_SIDE * 2, h: INTRO_BUTTON.y - BODY_MARGIN - top };
  const bodyFont = fitWrappedFont(body, bodyRect.w, bodyRect.h, { max: BODY_FONT, min: BODY_FONT_MIN, lineSpacing: BODY_LINE_SPACING });

  return { features, nameFont, groundW: 120 + total, body: bodyRect, bodyFont };
}
