import type Phaser from 'phaser';
import { fitScale } from '../ui/format';

/**
 * Short-lived visual effects. Saturated colour is allowed here: CLAUDE.md section 6 reserves it
 * for enemies, PAMP emblems and effects.
 */

const OUTLINE = 0x3a2a2a;
/** Energy produced by the bone marrow. */
export const ENERGY = 0xf3a23a;
const ENERGY_CORE = 0xfde3b0;
const ENERGY_GLOW = 0xf7c56e;
/** Cytokines: saturated teal, unlike anything else on the pink tissue, so the signal is easy to follow. */
export const CYTOKINE = 0x2fb5a8;
export const CYTOKINE_DARK = 0x1b7f76;
export const UI_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Draws one energy orb centred at (x, y) with outer radius r. */
export function drawEnergyOrb(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha = 1): void {
  if (r <= 0) return;
  g.fillStyle(ENERGY_GLOW, 0.35 * alpha).fillCircle(x, y, r * 1.45);
  g.fillStyle(ENERGY, alpha).fillCircle(x, y, r);
  g.fillStyle(ENERGY_CORE, alpha).fillCircle(x - r * 0.28, y - r * 0.28, r * 0.42);
  g.lineStyle(Math.max(2, r * 0.18), OUTLINE, alpha).strokeCircle(x, y, r);
}

/**
 * An energy orb that arcs from `from` to `to`, then calls `onArrive`. The arc rises above both
 * points so the trip reads as "leaving the producer and landing in the counter".
 */
export function flyEnergy(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  radius: number,
  onArrive: () => void,
  depth = 30,
): void {
  const g = scene.add.graphics().setDepth(depth);
  const cx = (from.x + to.x) / 2;
  const cy = Math.min(from.y, to.y) - 70;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: 620,
    ease: 'Sine.easeInOut',
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      const r = radius * (1 + 0.25 * Math.sin(t * Math.PI));
      g.clear();
      // Short trail behind the orb.
      for (let i = 1; i <= 3; i++) {
        const k = Math.max(0, t - i * 0.05);
        const v = 1 - k;
        drawEnergyOrb(g, v * v * from.x + 2 * v * k * cx + k * k * to.x, v * v * from.y + 2 * v * k * cy + k * k * to.y, r * (1 - i * 0.22), 0.35);
      }
      drawEnergyOrb(g, x, y, r);
    },
    onComplete: () => {
      g.destroy();
      onArrive();
    },
  });
}

/** A label that rises and fades, e.g. "+25" next to the energy counter. */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, size = 30, depth = 31): void {
  const label = scene.add
    .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#3A2A2A', strokeThickness: 6 })
    .setOrigin(0.5)
    .setDepth(depth);
  scene.tweens.add({ targets: label, y: y - 34, duration: 900, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: label, alpha: 0, duration: 400, delay: 600, onComplete: () => label.destroy() });
}

/** Expanding ring, for impacts and openings. */
export function ring(scene: Phaser.Scene, x: number, y: number, color: number, from: number, to: number, duration = 450, depth = 4): void {
  const g = scene.add.graphics().setDepth(depth);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    ease: 'Quad.easeOut',
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      g.clear().lineStyle(6 * (1 - t) + 1, color, 1 - t).strokeCircle(x, y, from + (to - from) * t);
    },
    onComplete: () => g.destroy(),
  });
}

/** A few specks thrown outward, for bites and deaths. */
export function specks(scene: Phaser.Scene, x: number, y: number, color: number, count = 5, depth = 4): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 18 + Math.random() * 16;
    const dot = scene.add.circle(x, y, 4 + Math.random() * 3, color).setStrokeStyle(2, OUTLINE).setDepth(depth);
    scene.tweens.add({
      targets: dot,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.4,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy(),
    });
  }
}

/**
 * A small signal particle that arcs from `from` to `to` (rising first), then calls `onArrive`.
 * Used for cytokines travelling from a macrophage to the meter.
 */
export function flyParticle(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: number,
  onArrive: () => void,
  duration = 800,
  depth = 30,
): void {
  const g = scene.add.graphics().setDepth(depth);
  const sway = (Math.random() - 0.5) * 120;
  const cx = (from.x + to.x) / 2 + sway;
  const cy = Math.min(from.y, to.y) - 40 - Math.random() * 40;
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    ease: 'Sine.easeIn',
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      g.clear();
      g.fillStyle(color, 0.35).fillCircle(x, y, 15);
      g.fillStyle(color, 1).fillCircle(x, y, 8);
      g.lineStyle(3, OUTLINE, 1).strokeCircle(x, y, 8);
      g.fillStyle(0xe8fbf8, 1).fillCircle(x - 3, y - 3, 2.5);
    },
    onComplete: () => {
      g.destroy();
      onArrive();
    },
  });
}

/**
 * Big level-start banner across the board: punches in with an overshoot, holds, then lifts away.
 * About 1.2 s in total; purely visual, so it never blocks input.
 */
export function banner(scene: Phaser.Scene, label: string, cx: number, cy: number, maxWidth = 1100, depth = 15): void {
  const text = scene.add
    .text(0, 0, label, { fontFamily: UI_FONT, fontSize: '104px', fontStyle: 'bold', color: '#FBF7F2', stroke: '#3A2A2A', strokeThickness: 16 })
    .setOrigin(0.5);
  const fit = fitScale(text.width + 60, maxWidth);
  const box = scene.add.graphics();
  const w = text.width + 90;
  const h = text.height + 30;
  box.fillStyle(0x7b4fa3, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, 36);
  box.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 36);
  const holder = scene.add.container(cx, cy, [box, text]).setDepth(depth).setScale(0).setAlpha(0).setAngle(-4);
  scene.tweens.add({ targets: holder, scale: fit, alpha: 1, angle: 0, duration: 260, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: holder,
    scale: fit * 1.18,
    alpha: 0,
    y: cy - 36,
    duration: 320,
    delay: 880,
    ease: 'Quad.easeIn',
    onComplete: () => holder.destroy(),
  });
}
