import Phaser from 'phaser';
import { UI_FONT } from '../game/effects';
import { t } from '../i18n';
import { TUTORIAL_ARROW, arrowDirection, pointInRect, tutorialLayout, type Rect, type TutorialLayout } from './layout';

const INK = '#3A2A2A';
const INK_LIGHT = '#FBF7F2';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xf3e4e0;
const PANEL_SHADE = 0xc9a6a1;
const ACCENT = 0x7b4fa3;
const DEPTH = 12;
const ARROW_LENGTH = TUTORIAL_ARROW.length;
const ARROW_BOB = TUTORIAL_ARROW.bob;

/** The marrow figure of the HUD, which the tutorial borrows as its tutor instead of drawing a second one. */
export interface MarrowTutor {
  setMarrowTalking(talking: boolean): void;
  nudgeMarrow(): void;
}

export interface TutorialGuideModel {
  /** Already translated line of the tutor. */
  text: string;
  /** Screen rectangles the step highlights, all framed at once; the arrow points at the first. */
  targets: readonly Rect[];
  /** The step ends with the "Siguiente" button of the bubble. */
  next: boolean;
}

/**
 * The tutor of a guided tutorial is the bone marrow of the HUD: a speech bubble comes out of its
 * panel with one short line and, on tap steps, a "Siguiente" button, plus a bobbing arrow and a pulsing frame on whatever the step points at.
 * It only draws; the scene feeds it the current step and routes the clicks.
 */
export class TutorialGuide {
  private readonly bubble: Phaser.GameObjects.Graphics;
  private readonly line: Phaser.GameObjects.Text;
  private readonly nextLabel: Phaser.GameObjects.Text;
  private readonly pointer: Phaser.GameObjects.Graphics;
  private layout: TutorialLayout = tutorialLayout(null);
  private shown = false;
  private drawn: { side: string; next: boolean } | null = null;
  private lastText = '';
  private hasNext = false;

  constructor(scene: Phaser.Scene, private readonly marrow: MarrowTutor) {
    const text = (size: number, color = INK): Phaser.GameObjects.Text =>
      scene.add.text(0, 0, '', { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color }).setDepth(DEPTH + 0.2);
    this.bubble = scene.add.graphics().setDepth(DEPTH + 0.1);
    this.line = text(24).setLineSpacing(4);
    this.nextLabel = text(22, INK_LIGHT).setOrigin(0.5);
    this.pointer = scene.add.graphics().setDepth(DEPTH + 0.3);
    this.setVisible(false);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** True over the "Siguiente" button; false while the guide is hidden or the step has no button. */
  overNext(x: number, y: number): boolean {
    return this.shown && this.hasNext && pointInRect(this.layout.next, x, y);
  }

  /** Redraws for this frame; null hides the guide. */
  update(model: TutorialGuideModel | null, now: number): void {
    if (!model) {
      if (this.shown) this.setVisible(false);
      return;
    }
    if (!this.shown) {
      this.setVisible(true);
      this.marrow.nudgeMarrow();
    }
    const layout = tutorialLayout(model.targets);
    const changed = this.drawn?.side !== layout.side || this.drawn.next !== model.next;
    if (changed) this.drawBubble(layout, model.next);
    if (changed || model.text !== this.lastText) {
      this.line.setText(model.text).setWordWrapWidth(layout.bubble.w - 48).setPosition(layout.bubble.x + 24, layout.bubble.y + 18);
      if (model.text !== this.lastText && this.lastText !== '') this.marrow.nudgeMarrow();
      this.lastText = model.text;
    }
    this.layout = layout;
    this.hasNext = model.next;
    this.drawPointer(model.targets, now);
  }

  destroy(): void {
    this.marrow.setMarrowTalking(false);
    for (const o of [this.bubble, this.line, this.nextLabel, this.pointer]) o.destroy();
  }

  private setVisible(visible: boolean): void {
    this.shown = visible;
    this.marrow.setMarrowTalking(visible);
    for (const o of [this.bubble, this.line, this.nextLabel, this.pointer]) o.setVisible(visible);
    if (!visible) {
      this.pointer.clear();
      this.drawn = null;
      this.lastText = '';
    }
  }

  private drawBubble(layout: TutorialLayout, next: boolean): void {
    this.drawn = { side: layout.side, next };
    const { bubble: b, next: s } = layout;
    const { baseX, baseY, tipX, tipY } = layout.tail;
    const g = this.bubble.clear();
    g.fillStyle(PANEL_SHADE, 1).fillRoundedRect(b.x, b.y + 6, b.w, b.h, 22);
    g.fillStyle(PANEL, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 22);
    g.lineStyle(5, OUTLINE, 1).strokeRoundedRect(b.x, b.y, b.w, b.h, 22);
    // Tail drawn over the border so bubble and pointer read as one shape.
    g.fillStyle(PANEL, 1).fillTriangle(baseX + 2, baseY - 16, baseX + 2, baseY + 16, tipX, tipY);
    g.lineStyle(5, OUTLINE, 1).lineBetween(baseX, baseY - 16, tipX, tipY).lineBetween(baseX, baseY + 16, tipX, tipY);
    if (next) {
      g.fillStyle(ACCENT, 1).fillRoundedRect(s.x, s.y, s.w, s.h, 14);
      g.lineStyle(4, OUTLINE, 1).strokeRoundedRect(s.x, s.y, s.w, s.h, 14);
    }
    this.nextLabel.setText(next ? t('tutorial.next') : '').setPosition(s.x + s.w / 2, s.y + s.h / 2);
  }

  /** Pulsing frame on every target and a bobbing arrow, coming from open space, on the first. */
  private drawPointer(targets: readonly Rect[], now: number): void {
    const g = this.pointer.clear();
    const target = targets[0];
    if (!target) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    const pad = 6 + 3 * pulse;
    for (const t of targets) {
      g.lineStyle(6, ACCENT, 0.65 + 0.35 * pulse).strokeRoundedRect(t.x - pad, t.y - pad, t.w + pad * 2, t.h + pad * 2, 20);
    }
    const bob = (0.5 + 0.5 * Math.sin(now / 170)) * ARROW_BOB;
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    const gap = pad + 4;
    switch (arrowDirection(target)) {
      case 'down':
        this.arrow(g, cx, target.y - gap - bob, 90);
        break;
      case 'up':
        this.arrow(g, cx, target.y + target.h + gap + bob, -90);
        break;
      case 'right':
        this.arrow(g, target.x - gap - bob, cy, 0);
        break;
    }
  }

  /** A chunky arrow whose tip is at (x, y), pointing along `angle` degrees (0 = right, 90 = down). */
  private arrow(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number): void {
    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    // Outline points for an arrow pointing right with its tip at the origin.
    const shape: Array<[number, number]> = [
      [0, 0],
      [-26, -24],
      [-26, -10],
      [-ARROW_LENGTH, -10],
      [-ARROW_LENGTH, 10],
      [-26, 10],
      [-26, 24],
    ];
    const pts = shape.map(([px, py]) => new Phaser.Math.Vector2(x + px * cos - py * sin, y + px * sin + py * cos));
    g.fillStyle(0xf7c56e, 1).fillPoints(pts, true);
    g.lineStyle(5, OUTLINE, 1).strokePoints(pts, true, true);
  }
}
