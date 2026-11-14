import type Phaser from 'phaser';
import { fullscreenActive, fullscreenSupported, toggleFullscreen } from '../game/fullscreen';
import { t } from '../i18n';
import { fullscreenHit, fullscreenSlots, type FullscreenSlots } from './fullscreenLayout';
import type { Rect } from './layout';

const INK = '#3A2A2A';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xfbf7f2;
const UI_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export interface FullscreenButtonOptions {
  /** Button face; defaults to the menu/almanac panel colour. */
  fill?: number;
  /** Draw a drop shadow in this colour, matching the HUD's buttons. */
  shade?: number;
  depth?: number;
}

/**
 * Fullscreen toggle shared by the menu, the game and the almanac: a rounded button with a
 * four-corner glyph that flips between "expand" and "restore". It is only built when the browser
 * can do real fullscreen, so platforms without the API (iOS Safari, framed players) never show
 * a dead control.
 */
export class FullscreenButton {
  private readonly slots: FullscreenSlots;
  private readonly fill: number;
  private readonly shade: number | undefined;
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    private readonly rect: Rect,
    options: FullscreenButtonOptions = {},
  ) {
    this.slots = fullscreenSlots(rect);
    this.fill = options.fill ?? PANEL;
    this.shade = options.shade;
    const depth = options.depth ?? 8;
    this.g = scene.add.graphics().setDepth(depth);
    this.label = scene.add
      .text(rect.x + rect.w / 2, this.slots.labelY, '', {
        fontFamily: UI_FONT,
        fontSize: `${this.slots.font}px`,
        fontStyle: 'bold',
        color: INK,
        align: 'center',
        wordWrap: { width: rect.w - 12 },
      })
      .setOrigin(0.5, 0)
      .setDepth(depth);
    this.draw();
    document.addEventListener('fullscreenchange', this.onChange);
    document.addEventListener('webkitfullscreenchange', this.onChange);
  }

  hit(x: number, y: number): boolean {
    return !this.destroyed && fullscreenHit(this.rect, x, y);
  }

  toggle(): void {
    void toggleFullscreen();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    document.removeEventListener('fullscreenchange', this.onChange);
    document.removeEventListener('webkitfullscreenchange', this.onChange);
    this.g.destroy();
    this.label.destroy();
  }

  private readonly onChange = (): void => this.draw();

  private draw(): void {
    const r = this.rect;
    const active = fullscreenActive();
    const g = this.g.clear();
    if (this.shade !== undefined) g.fillStyle(this.shade, 1).fillRoundedRect(r.x, r.y + 5, r.w, r.h, 18);
    g.fillStyle(this.fill, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    g.lineStyle(4, OUTLINE, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 18);
    this.drawGlyph(g, active);
    this.label.setText(t(active ? 'action.fullscreen_exit' : 'action.fullscreen'));
  }

  /**
   * Four corner brackets. Expanding: corners on the outside with their arms pointing inward.
   * Restoring: corners pulled to the middle with their arms pointing outward.
   */
  private drawGlyph(g: Phaser.GameObjects.Graphics, active: boolean): void {
    const { iconX: cx, iconY: cy, iconSize: size } = this.slots;
    const arm = Math.round(size * 0.6);
    const line = Math.max(3, Math.round(size * 0.32));
    g.lineStyle(line, OUTLINE, 1);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = cx + sx * size * (active ? 0.5 : 1);
        const y = cy + sy * size * (active ? 0.5 : 1);
        const direction = active ? -1 : 1;
        g.lineBetween(x, y, x - sx * arm * direction, y);
        g.lineBetween(x, y, x, y - sy * arm * direction);
      }
    }
  }
}

/** Builds the toggle, or returns null when this browser cannot go fullscreen. */
export function createFullscreenButton(
  scene: Phaser.Scene,
  rect: Rect,
  options: FullscreenButtonOptions = {},
): FullscreenButton | null {
  return fullscreenSupported() ? new FullscreenButton(scene, rect, options) : null;
}
