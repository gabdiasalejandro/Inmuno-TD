import type Phaser from 'phaser';
import type { LevelIntro } from '../data';
import { UI_FONT } from '../game/effects';
import { createFigure, type Figure } from '../game/figures';
import { t } from '../i18n';
import { fitScale } from './format';
import { BODY_FONT, BODY_FONT_MIN, BODY_LINE_SPACING, FEATURE_FOOT_Y, introLayout } from './introLayout';
import { CANVAS, INTRO_BUTTON, INTRO_CARD } from './layout';

const INK = '#3A2A2A';
const INK_LIGHT = '#FBF7F2';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xf3e4e0;
const PANEL_SHADE = 0xc9a6a1;
const ACCENT = 0x7b4fa3;
const FEATURE_SCALE = 0.9;
const SOLO_SCALE = 1.1;

/** Name of a unit or enemy; the translator returns the key itself when it is missing. */
function characterName(id: string): string {
  const unit = t(`unit.${id}.name`);
  return unit !== `unit.${id}.name` ? unit : t(`enemy.${id}.name`);
}

/**
 * The flashcard shown before a level: one idea (title and a short sentence), the characters it
 * is about, and a big start button. The caller routes taps with `introHit` from `ui/layout`.
 */
export class IntroCard {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly figures: Figure[] = [];

  constructor(scene: Phaser.Scene, intro: LevelIntro) {
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      this.objects.push(object);
      return object;
    };
    const cx = CANVAS.w / 2;
    const card = INTRO_CARD;
    const names = intro.feature.map(characterName);
    const body = t(intro.body);
    const layout = introLayout(names, body);

    const dim = add(scene.add.graphics().setDepth(20));
    dim.fillStyle(OUTLINE, 0.62).fillRect(0, 0, CANVAS.w, CANVAS.h);
    dim.fillStyle(PANEL_SHADE, 1).fillRoundedRect(card.x, card.y + 8, card.w, card.h, 34);
    dim.fillStyle(PANEL, 1).fillRoundedRect(card.x, card.y, card.w, card.h, 34);
    dim.lineStyle(6, OUTLINE, 1).strokeRoundedRect(card.x, card.y, card.w, card.h, 34);
    // A soft ground disc under the characters.
    dim.fillStyle(PANEL_SHADE, 0.6).fillEllipse(cx, FEATURE_FOOT_Y + 2, layout.groundW, 34);

    add(
      scene.add
        .text(cx, card.y + 70, t(intro.title), { fontFamily: UI_FONT, fontSize: '58px', fontStyle: 'bold', color: INK, align: 'center' })
        .setOrigin(0.5)
        .setDepth(21),
    );

    const count = intro.feature.length;
    intro.feature.forEach((id, i) => {
      const { x, font, name } = layout.features[i]!;
      this.figures.push(createFigure(scene, id, x, FEATURE_FOOT_Y, count === 1 ? SOLO_SCALE : FEATURE_SCALE).setDepth(21).idle().pop());
      const label = add(
        scene.add
          .text(x, name.y, names[i]!, { fontFamily: UI_FONT, fontSize: `${font}px`, fontStyle: 'bold', color: INK })
          .setOrigin(0.5, 0)
          .setDepth(21),
      );
      // The layout estimates widths; if the real font runs wider, the name shrinks into its slot.
      label.setScale(fitScale(label.width, name.w));
    });

    const box = layout.body;
    const text = add(
      scene.add
        .text(cx, box.y, body, {
          fontFamily: UI_FONT,
          fontSize: `${BODY_FONT}px`,
          color: INK,
          align: 'center',
          wordWrap: { width: box.w },
          lineSpacing: BODY_LINE_SPACING,
        })
        .setOrigin(0.5, 0)
        .setDepth(21),
    );
    // The body shrinks, measuring the real text, until it ends above the start button. The layout's
    // own estimate (`bodyFont`, checked in tests) is conservative, so this usually stops above it.
    for (let size = BODY_FONT - 1; text.height > box.h && size >= BODY_FONT_MIN; size--) text.setFontSize(size);

    // The button is a container so it can breathe: that is the "tap me" cue.
    const b = INTRO_BUTTON;
    const button = add(scene.add.container(b.x + b.w / 2, b.y + b.h / 2).setDepth(21));
    const face = scene.add.graphics();
    face.fillStyle(PANEL_SHADE, 1).fillRoundedRect(-b.w / 2, -b.h / 2 + 6, b.w, b.h, 24);
    face.fillStyle(ACCENT, 1).fillRoundedRect(-b.w / 2, -b.h / 2, b.w, b.h, 24);
    face.lineStyle(5, OUTLINE, 1).strokeRoundedRect(-b.w / 2, -b.h / 2, b.w, b.h, 24);
    const label = scene.add
      .text(0, 0, t('action.start'), { fontFamily: UI_FONT, fontSize: '44px', fontStyle: 'bold', color: INK_LIGHT })
      .setOrigin(0.5);
    button.add([face, label]);
    scene.tweens.add({ targets: button, scale: 1.05, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  destroy(): void {
    for (const figure of this.figures) figure.destroy();
    for (const object of this.objects) object.destroy();
    this.figures.length = 0;
    this.objects.length = 0;
  }
}
