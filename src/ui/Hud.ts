import type Phaser from 'phaser';
import { CYTOKINE, CYTOKINE_DARK, UI_FONT, drawEnergyOrb, floatText, flyEnergy, specks } from '../game/effects';
import { createFigure, type Figure } from '../game/figures';
import type { ResultAction } from '../game/flow';
import { t } from '../i18n';
import { secondsToTicks, type UnitDef } from '../sim';
import { fitScale, formatClock, formatGain, formatMultiplier, isSpedUp } from './format';
import {
  CANVAS,
  ENERGY_COUNTER,
  ENERGY_ICON,
  MARROW_ANCHOR,
  MARROW_LABEL,
  MARROW_CORE,
  MARROW_PANEL,
  MARROW_RING,
  HINT_BUBBLE,
  LINK_Y,
  MARROW_LINK_X,
  RESULT_PANEL,
  cardSlots,
  hintTail,
  hudLayout,
  meterChips,
  pointInRect,
  resultButtons,
  type HudLayout,
  type Rect,
  type ResultButton,
} from './layout';

const INK = '#3A2A2A';
const INK_LIGHT = '#FBF7F2';
const WARN_TEXT = '#A8392F';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xf3e4e0;
const PANEL_SHADE = 0xc9a6a1;
const SELECTED = 0x7b4fa3;
const WARN = 0xb5483f;
const TIME_FILL = 0x8aa9b8;
const TIME_LOW = 0xc98a6a;

const SHAKE_MS = 350;
const TOAST_MS = 1500;
const MARROW_SCALE = 0.6;
const HINT_MS = 5200;
const ENERGY_HOT = 0xe8602c;
const ENERGY_BASE = 0xf3a23a;

function lerpHex(a: number, b: number, k: number): number {
  const mix = (shift: number): number => Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
const RESULT_FIGURE_SCALE = 0.62;

export interface HudModel {
  /** Scene clock in ms, used for UI-only animation. */
  now: number;
  tick: number;
  energy: number;
  deployReadyAt: Record<string, number>;
  selected: string | null;
  /** Remaining and total survive time in seconds, or null when the level has no timer. */
  remainingSeconds: number | null;
  totalSeconds: number | null;
  /** Bacteria still to defeat in a clear level, or null in a timed one. */
  remainingEnemies: number | null;
  totalEnemies: number;
  /** Marrow progress toward its next energy batch, 0..1. */
  charge: number;
  /** How hard the marrow is working because of cytokines, 0..1. */
  excite: number;
  /** Cytokine level 0..1, or null in levels where the signal is not active. */
  cytokines: number | null;
  /** Live speed multipliers cytokines grant (marrow production, neutrophil redeploy), or null without the signal. */
  effects: { marrow: number; recruit: number } | null;
  /** Ids of the cards whose redeploy is currently speeded up by cytokines. */
  boosted: ReadonlySet<string>;
  shake: { defId: string; until: number } | null;
}

interface CardView {
  def: UnitDef;
  figure: Figure;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

function text(scene: Phaser.Scene, size: number, bold = false, color = INK): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, '', { fontFamily: UI_FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
    .setDepth(7);
}

function panel(g: Phaser.GameObjects.Graphics, r: Rect, radius: number, fill = PANEL, alpha = 1): void {
  g.fillStyle(PANEL_SHADE, alpha).fillRoundedRect(r.x, r.y + 5, r.w, r.h, radius);
  g.fillStyle(fill, alpha).fillRoundedRect(r.x, r.y, r.w, r.h, radius);
  g.lineStyle(4, OUTLINE, alpha).strokeRoundedRect(r.x, r.y, r.w, r.h, radius);
}

/**
 * Bone marrow and energy, cards, countdown, menu button, placement feedback toast and the
 * end-of-level overlay.
 */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly cards: CardView[];
  private readonly marrow: Figure;
  private readonly core: Phaser.GameObjects.Graphics;
  private readonly energyValue: Phaser.GameObjects.Text;
  private readonly timeLabel: Phaser.GameObjects.Text;
  private readonly timeValue: Phaser.GameObjects.Text;
  private readonly layout: HudLayout;
  private readonly meterLabel: Phaser.GameObjects.Text | null = null;
  private meterBumpAt = -Infinity;
  private readonly chipTexts: { marrow: Phaser.GameObjects.Text; recruit: Phaser.GameObjects.Text } | null = null;
  private hint: { until: number; box: Phaser.GameObjects.Graphics; title: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text } | null = null;
  private lastSpark = 0;
  private readonly toastBox: Phaser.GameObjects.Graphics;
  private readonly toast: Phaser.GameObjects.Text;
  private toastUntil = 0;
  /** Energy already in the sim but still flying toward the counter. */
  private pending = 0;
  private bumpAt = -Infinity;
  private overlay: Array<Phaser.GameObjects.GameObject | Figure> = [];
  private buttons: ResultButton[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    defs: UnitDef[],
    options: { meter: boolean; clear: boolean },
  ) {
    this.layout = hudLayout(defs.length, options.meter);
    const { timer, meter } = this.layout;
    const statics = scene.add.graphics().setDepth(5);
    panel(statics, MARROW_PANEL, 22);
    panel(statics, timer, 18);
    if (meter) panel(statics, meter, 18);
    this.drawMenuButton(statics);

    this.g = scene.add.graphics().setDepth(6);
    this.marrow = createFigure(scene, 'medula_osea', MARROW_ANCHOR.x, MARROW_ANCHOR.y, MARROW_SCALE).setDepth(6.5).idle();
    // Above the marrow figure: the batch growing inside its cavity.
    this.core = scene.add.graphics().setDepth(6.8);

    // Name tag over the marrow's feet: the one place the HUD says what produces the energy.
    const marrowName = text(scene, 15, true).setText(t('hud.marrow')).setOrigin(0.5, 0.5).setPosition(MARROW_LABEL.x, MARROW_LABEL.y);
    const tagW = marrowName.width + 18;
    const tag = scene.add.graphics().setDepth(6.9);
    tag.fillStyle(PANEL, 1).fillRoundedRect(MARROW_LABEL.x - tagW / 2, MARROW_LABEL.y - 12, tagW, 24, 12);
    tag.lineStyle(3, OUTLINE, 1).strokeRoundedRect(MARROW_LABEL.x - tagW / 2, MARROW_LABEL.y - 12, tagW, 24, 12);

    this.cards = defs.map((def, i) => ({
      def,
      figure: createFigure(scene, def.id, 0, 0, cardSlots((this.layout.cards[i] as Rect).w).figureScale).setDepth(6.5).idle(),
      name: text(scene, 18, true).setOrigin(0.5, 0),
      cost: text(scene, cardSlots((this.layout.cards[i] as Rect).w).costFont, true).setOrigin(1, 0.5),
    }));

    text(scene, 19, true).setText(t('hud.energy')).setOrigin(0.5, 0).setPosition(ENERGY_COUNTER.x + ENERGY_COUNTER.w / 2, ENERGY_COUNTER.y + 78);
    this.energyValue = text(scene, 42, true).setOrigin(0, 0.5).setPosition(ENERGY_ICON.x + ENERGY_ICON.r + 10, ENERGY_ICON.y);
    // A stacked (short) timer panel puts label and value on one line; a tall one leaves room for a bar.
    const compact = timer.h < 80;
    this.timeLabel = text(scene, compact ? 20 : 22, true)
      .setText(t(options.clear ? 'hud.remaining' : 'hud.time_left'))
      .setOrigin(0, compact ? 0.5 : 0)
      .setPosition(timer.x + 16, compact ? timer.y + timer.h / 2 : timer.y + 14);
    this.timeValue = text(scene, compact ? 32 : 40, true)
      .setOrigin(1, compact ? 0.5 : 0)
      .setPosition(timer.x + timer.w - 16, compact ? timer.y + timer.h / 2 : timer.y + 6);
    if (meter) {
      this.meterLabel = text(scene, 16, true).setText(t('hud.cytokines')).setPosition(meter.x + 16, meter.y + 5);
      this.chipTexts = { marrow: text(scene, 13, true).setOrigin(1, 0.5), recruit: text(scene, 13, true).setOrigin(1, 0.5) };
    }

    this.toastBox = scene.add.graphics().setDepth(9);
    this.toast = text(scene, 24, true, INK_LIGHT).setOrigin(0.5, 0.5).setPosition(CANVAS.w / 2, 190).setDepth(10).setAlpha(0);
  }

  get cardCount(): number {
    return this.cards.length;
  }

  /** Where cytokine particles should land: the middle of the meter, or null without one. */
  get meterTarget(): { x: number; y: number } | null {
    const m = this.layout.meter;
    return m ? { x: m.x + m.w / 2, y: m.y + m.h - 14 } : null;
  }

  /** A cytokine arrived: the meter bumps. */
  bumpMeter(now: number): void {
    this.meterBumpAt = now;
  }

  cardId(index: number): string | undefined {
    return this.cards[index]?.def.id;
  }

  /** Buttons of the result overlay currently on screen (empty while playing). */
  get resultButtons(): ResultButton[] {
    return this.buttons;
  }

  showToast(message: string, now: number): void {
    this.toast.setText(message);
    this.toastUntil = now + TOAST_MS;
  }

  /**
   * A batch of energy leaves the marrow and flies to the counter; the counter only counts it
   * on arrival, so the number visibly comes from the marrow.
   */
  produce(amount: number): void {
    this.pending += amount;
    this.marrow.squeeze();
    flyEnergy(this.scene, MARROW_CORE, ENERGY_ICON, 14, () => {
      this.pending = Math.max(0, this.pending - amount);
      this.bumpAt = this.scene.time.now;
      floatText(this.scene, ENERGY_ICON.x + 66, ENERGY_ICON.y - 20, formatGain(amount), '#F7C56E', 28, 11);
    });
  }

  update(m: HudModel): void {
    const g = this.g.clear();
    const shown = Math.max(0, m.energy - this.pending);
    this.drawMarrow(g, m);
    this.drawEnergy(g, shown, m.now);
    this.cards.forEach((card, i) => this.drawCard(g, card, i, m, shown));
    this.drawTimer(g, m);
    this.drawMeter(g, m);
    this.drawLinks(g, m);
    this.drawHint(m.now);
    this.drawToast(m.now);
  }

  private drawMarrow(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const { charge, excite } = m;
    const { x, y: cy, r: ring } = MARROW_RING;
    // Cytokines make the marrow work harder: faster idle, a livelier swell, a hotter and
    // throbbing ring, and sparks flying off it.
    const throb = 0.5 + 0.5 * Math.sin(m.now / (150 - 80 * excite));
    // Charge ring around the whole marrow figure: fills clockwise toward the next batch.
    g.lineStyle(9, OUTLINE, 0.12).strokeCircle(x, cy, ring);
    if (excite > 0) g.fillStyle(ENERGY_HOT, 0.12 * excite * (0.5 + throb)).fillCircle(x, cy, ring + 4);
    if (charge > 0) {
      g.lineStyle(9 + 4 * excite * throb, lerpHex(ENERGY_BASE, ENERGY_HOT, excite), 1);
      g.beginPath();
      g.arc(x, cy, ring, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2, false);
      g.strokePath();
    }
    // The batch itself grows inside the marrow cavity and glows when nearly ready.
    this.marrow.setExcite(excite).setSwell(0.04 * charge * charge + 0.03 * excite * throb);
    const glow = charge > 0.8 ? 0.5 + 0.5 * Math.sin(m.now / 60) : 0;
    if (glow > 0) g.fillStyle(0xf7c56e, 0.25 * glow).fillCircle(x, cy, ring - 8);
    drawEnergyOrb(this.core.clear(), MARROW_CORE.x, MARROW_CORE.y, 3 + 10 * charge, 0.6 + 0.4 * charge);
    if (excite > 0.15 && m.now - this.lastSpark > 140 - 90 * excite) {
      this.lastSpark = m.now;
      const angle = Math.random() * Math.PI * 2;
      specks(this.scene, x + Math.cos(angle) * (ring - 4), cy + Math.sin(angle) * (ring - 4), ENERGY_HOT, 2, 7);
    }
  }

  private drawEnergy(g: Phaser.GameObjects.Graphics, energy: number, now: number): void {
    const k = Math.max(0, 1 - (now - this.bumpAt) / 260);
    const bump = 1 + 0.2 * Math.sin(k * Math.PI);
    drawEnergyOrb(g, ENERGY_ICON.x, ENERGY_ICON.y, ENERGY_ICON.r * bump);
    this.energyValue.setText(String(Math.floor(energy))).setScale(bump);
  }

  private drawCard(g: Phaser.GameObjects.Graphics, card: CardView, index: number, m: HudModel, energy: number): void {
    const { def } = card;
    const r = this.layout.cards[index] as Rect;
    const selected = m.selected === def.id;
    const readyAt = m.deployReadyAt[def.id] ?? 0;
    const cooldownTotal = secondsToTicks(def.cooldown);
    const cooling = Math.max(0, readyAt - m.tick);
    const affordable = energy >= def.cost;
    const usable = affordable && cooling === 0;
    const shaking = m.shake?.defId === def.id && m.now < m.shake.until;
    const boosted = m.boosted.has(def.id);
    const dx = shaking ? Math.sin((m.now / SHAKE_MS) * Math.PI * 8) * 7 : 0;
    const x = r.x + dx;
    const y = r.y - (selected ? 6 : 0);
    const alpha = usable ? 1 : 0.7;
    const slots = cardSlots(r.w, r.h);
    const figureX = x + slots.figureX;

    g.fillStyle(PANEL_SHADE, 1).fillRoundedRect(x, y + 5, r.w, r.h, 16);
    g.fillStyle(selected ? 0xfbf3ef : PANEL, 1).fillRoundedRect(x, y, r.w, r.h, 16);
    // Figure plinth: a soft disc the character stands on.
    g.fillStyle(PANEL_SHADE, 0.55).fillEllipse(figureX, y + slots.figureGround - 2, Math.min(76, slots.figureZone.w), 14);
    g.lineStyle(selected ? 7 : 4, selected ? SELECTED : shaking ? WARN : OUTLINE, 1);
    g.strokeRoundedRect(x, y, r.w, r.h, 16);

    card.figure.setPosition(figureX, y + slots.figureGround).setDim(!usable);

    if (cooling > 0 && cooldownTotal > 0) {
      const h = (r.h - 8) * Math.min(1, cooling / cooldownTotal);
      const radii = { tl: 12, tr: 12, bl: h > r.h - 20 ? 12 : 0, br: h > r.h - 20 ? 12 : 0 };
      g.fillStyle(boosted ? CYTOKINE_DARK : OUTLINE, boosted ? 0.45 : 0.3).fillRoundedRect(x + 4, y + 4, r.w - 8, h, radii);
      // Cytokines at work: arrows climb the card, and the cooldown edge glows, so it reads as "refilling faster".
      if (boosted) {
        g.fillStyle(CYTOKINE, 0.95).fillRect(x + 4, y + 4 + h - 3, r.w - 8, 3);
        for (let k = 0; k < 3; k++) {
          const t = ((m.now / 520 + k / 3) % 1);
          const ay = y + r.h - 12 - t * (r.h - 24);
          this.arrow(g, x + r.w - 22, ay, 1 - Math.abs(t - 0.5) * 1.6);
        }
      }
    }
    if (boosted) {
      // Badge in the corner while the boost lasts, even when the card is ready.
      const bx = x + slots.badge.x;
      const by = y + slots.badge.y;
      const pulse = 0.5 + 0.5 * Math.sin(m.now / 140);
      g.fillStyle(CYTOKINE, 1).fillCircle(bx, by, 11 + pulse * 1.5);
      g.lineStyle(3, OUTLINE, 1).strokeCircle(bx, by, 11 + pulse * 1.5);
      g.fillStyle(0xe8fbf8, 1).fillTriangle(bx, by - 6, bx - 6, by + 4, bx + 6, by + 4);
    }

    card.name.setText(t(`unit.${def.id}.name`)).setScale(fitScale(card.name.width, slots.name.w)).setPosition(x + slots.name.x + slots.name.w / 2, y + 8).setAlpha(alpha);
    const costRight = x + slots.cost.x + slots.cost.w;
    const costY = y + slots.cost.y + slots.cost.h / 2;
    card.cost.setText(String(def.cost)).setPosition(costRight, costY).setAlpha(alpha);
    drawEnergyOrb(g, costRight - card.cost.width - 16, costY, 10, affordable ? 1 : 0.5);
    card.cost.setColor(affordable ? INK : WARN_TEXT);
  }

  private arrow(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha: number): void {
    g.fillStyle(CYTOKINE, Math.max(0, Math.min(1, alpha))).fillTriangle(x, y - 7, x - 8, y + 5, x + 8, y + 5);
  }

  private drawTimer(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const rect = this.layout.timer;
    const counting = m.remainingEnemies !== null;
    const remaining = counting ? m.remainingEnemies : m.remainingSeconds;
    const total = counting ? m.totalEnemies : m.totalSeconds;
    const visible = remaining !== null && total !== null && total > 0;
    this.timeLabel.setVisible(visible);
    this.timeValue.setVisible(visible);
    if (!visible) return;
    const fraction = Math.max(0, Math.min(1, remaining / total));
    const low = !counting && remaining <= 10;
    this.timeValue.setText(counting ? String(remaining) : formatClock(remaining));
    if (rect.h < 80) return;
    const bar = { x: rect.x + 18, y: rect.y + 62, w: rect.w - 36, h: 24 };
    g.fillStyle(OUTLINE, 0.14).fillRoundedRect(bar.x, bar.y, bar.w, bar.h, 12);
    // Time drains toward the end; the bacteria bar drains as the infection is cleared.
    const w = bar.w * fraction;
    if (w > 2) {
      const pulse = low ? 0.75 + 0.25 * Math.sin(m.now / 120) : 1;
      g.fillStyle(low ? TIME_LOW : counting ? 0xb09ae0 : TIME_FILL, pulse).fillRoundedRect(bar.x, bar.y, Math.max(w, 24), bar.h, 12);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, 12);
  }

  /** Cytokine meter: a teal bar that bumps when particles arrive and shimmers while it is high. */
  private drawMeter(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const rect = this.layout.meter;
    if (!rect || m.cytokines === null) return;
    const level = Math.max(0, Math.min(1, m.cytokines));
    const bump = Math.max(0, 1 - (m.now - this.meterBumpAt) / 220);
    const bar = { x: rect.x + 14, y: rect.y + 26, w: rect.w - 28, h: 15 };
    g.fillStyle(OUTLINE, 0.16).fillRoundedRect(bar.x, bar.y, bar.w, bar.h, 8);
    const w = bar.w * level;
    if (w > 2) {
      g.fillStyle(CYTOKINE, 1).fillRoundedRect(bar.x, bar.y, Math.max(w, 16), bar.h, 8);
      g.fillStyle(0xe8fbf8, 0.5).fillRoundedRect(bar.x + 3, bar.y + 2, Math.max(w, 16) - 6, 4, 2);
    }
    if (bump > 0) {
      g.lineStyle(4, CYTOKINE, bump).strokeRoundedRect(rect.x - 3 * bump, rect.y - 3 * bump, rect.w + 6 * bump, rect.h + 6 * bump, 20);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, 8);
    this.meterLabel?.setColor(level > 0.05 ? '#1B7F76' : INK);
    if (m.effects) this.drawChips(g, m.effects, rect);
  }

  /** Two chips under the label: what the meter does right now. Idle (grey) at x1, teal when it speeds things up. */
  private drawChips(g: Phaser.GameObjects.Graphics, effects: { marrow: number; recruit: number }, meter: Rect): void {
    const chips = meterChips(meter);
    const entries = [
      { rect: chips.marrow, value: effects.marrow, text: this.chipTexts?.marrow, icon: 'orb' },
      { rect: chips.recruit, value: effects.recruit, text: this.chipTexts?.recruit, icon: 'cell' },
    ] as const;
    for (const { rect, value, text: label, icon } of entries) {
      const lit = isSpedUp(value);
      g.fillStyle(lit ? CYTOKINE : OUTLINE, lit ? 0.3 : 0.1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 10);
      g.lineStyle(2, lit ? CYTOKINE : OUTLINE, lit ? 1 : 0.35).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 10);
      const ix = rect.x + 11;
      const iy = rect.y + rect.h / 2;
      if (icon === 'orb') {
        drawEnergyOrb(g, ix, iy, 6, lit ? 1 : 0.45);
      } else {
        // A tiny neutrophil: pale body, purple lobes.
        g.fillStyle(0xfbf7f2, lit ? 1 : 0.5).fillCircle(ix, iy, 6.5);
        g.lineStyle(2, OUTLINE, lit ? 1 : 0.45).strokeCircle(ix, iy, 6.5);
        g.fillStyle(0x7b4fa3, lit ? 1 : 0.5).fillCircle(ix - 2, iy - 1, 2).fillCircle(ix + 2, iy + 1, 2);
      }
      label
        ?.setText(formatMultiplier(value))
        .setColor(lit ? '#145F58' : INK)
        .setAlpha(lit ? 1 : 0.55)
        .setPosition(rect.x + rect.w - 6, rect.y + rect.h / 2 + 1);
    }
  }

  /**
   * A thin teal line under the strip ties the meter to the things it speeds up: the marrow panel
   * and every card whose redeploy is boosted. Only while the multipliers are above x1.
   */
  private drawLinks(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const meter = this.layout.meter;
    if (!meter || !m.effects) return;
    const marrowOn = isSpedUp(m.effects.marrow);
    const cards = this.layout.cards.filter((_, i) => m.boosted.has(this.cards[i]?.def.id ?? ''));
    if (!marrowOn && cards.length === 0) return;
    const meterX = meter.x + meter.w - 24;
    const ends: Array<{ x: number; from: number }> = [{ x: meterX, from: meter.y + meter.h }];
    if (marrowOn) ends.push({ x: MARROW_LINK_X, from: MARROW_PANEL.y + MARROW_PANEL.h });
    for (const c of cards) ends.push({ x: c.x + c.w / 2, from: c.y + c.h });
    const xs = ends.map((e) => e.x);
    g.lineStyle(3, CYTOKINE, 0.85).lineBetween(Math.min(...xs), LINK_Y, Math.max(...xs), LINK_Y);
    for (const e of ends) {
      g.lineBetween(e.x, e.from, e.x, LINK_Y);
      g.fillStyle(CYTOKINE, 0.85).fillCircle(e.x, e.from, 4);
    }
    if (marrowOn) g.lineStyle(4, CYTOKINE, 0.7).strokeRoundedRect(MARROW_PANEL.x - 3, MARROW_PANEL.y - 3, MARROW_PANEL.w + 6, MARROW_PANEL.h + 6, 24);
    for (const c of cards) g.lineStyle(4, CYTOKINE, 0.7).strokeRoundedRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, 19);
  }

  /** Shows the one-time explanation of the meter for a few seconds; a tap anywhere on it closes it. */
  showCytokineHint(now: number): void {
    const meter = this.layout.meter;
    if (!meter || this.hint) return;
    const pad = 16;
    const title = text(this.scene, 22, true, '#145F58').setText(t('hint.cytokines.title')).setDepth(9.2).setPosition(HINT_BUBBLE.x + pad, HINT_BUBBLE.y + 10);
    const body = text(this.scene, 18)
      .setText(t('hint.cytokines.body'))
      .setDepth(9.2)
      .setWordWrapWidth(HINT_BUBBLE.w - pad * 2)
      .setLineSpacing(2)
      .setPosition(HINT_BUBBLE.x + pad, HINT_BUBBLE.y + 40);
    const h = Math.max(HINT_BUBBLE.h, 40 + body.height + 14);
    const box = this.scene.add.graphics().setDepth(9.1);
    const tail = hintTail(meter);
    box.fillStyle(PANEL, 0.97).fillRoundedRect(HINT_BUBBLE.x, HINT_BUBBLE.y, HINT_BUBBLE.w, h, 20);
    box.fillTriangle(tail.baseX - 16, tail.baseY + 2, tail.baseX + 16, tail.baseY + 2, tail.tipX, tail.tipY);
    box.lineStyle(4, CYTOKINE, 1).strokeRoundedRect(HINT_BUBBLE.x, HINT_BUBBLE.y, HINT_BUBBLE.w, h, 20);
    // The tail is drawn over the border so the bubble and its pointer read as one shape.
    box.fillStyle(PANEL, 0.97).fillTriangle(tail.baseX - 14, tail.baseY + 3, tail.baseX + 14, tail.baseY + 3, tail.tipX, tail.tipY + 1);
    box.lineStyle(4, CYTOKINE, 1).lineBetween(tail.baseX - 16, tail.baseY, tail.tipX, tail.tipY).lineBetween(tail.baseX + 16, tail.baseY, tail.tipX, tail.tipY);
    this.hint = { until: now + HINT_MS, box, title, body };
    for (const o of [box, title, body]) o.setAlpha(0);
  }

  /** True when a tap at this point lands on the visible hint. It closes it and the tap goes no further. */
  tapHint(x: number, y: number): boolean {
    if (!this.hint) return false;
    const meter = this.layout.meter;
    const h = Math.max(HINT_BUBBLE.h, 40 + this.hint.body.height + 14);
    const onTail = meter ? Math.abs(x - hintTail(meter).tipX) < 24 && y >= meter.y + meter.h && y <= HINT_BUBBLE.y : false;
    if (!pointInRect({ ...HINT_BUBBLE, h }, x, y) && !onTail) return false;
    this.closeHint();
    return true;
  }

  private closeHint(): void {
    if (!this.hint) return;
    for (const o of [this.hint.box, this.hint.title, this.hint.body]) o.destroy();
    this.hint = null;
  }

  private drawHint(now: number): void {
    const hint = this.hint;
    if (!hint) return;
    if (now >= hint.until) {
      this.closeHint();
      return;
    }
    const alpha = Math.min(1, (now - (hint.until - HINT_MS)) / 250, (hint.until - now) / 400);
    for (const o of [hint.box, hint.title, hint.body]) o.setAlpha(Math.max(0, alpha));
  }

  private drawMenuButton(g: Phaser.GameObjects.Graphics): void {
    const r = this.layout.menu;
    panel(g, r, 18);
    const cx = r.x + r.w / 2;
    // The fullscreen toggle sits above it, so the menu button is short: icon and label stack tighter.
    const compact = r.h < 76;
    const iconY = r.y + (compact ? 22 : 32);
    const gap = compact ? 6 : 10;
    g.lineStyle(compact ? 5 : 6, OUTLINE, 1);
    for (const dy of [-gap, 0, gap]) g.lineBetween(cx - 20, iconY + dy, cx + 20, iconY + dy);
    text(this.scene, compact ? 17 : 20, true).setText(t('action.menu')).setOrigin(0.5, 0).setPosition(cx, r.y + (compact ? 38 : 50));
  }

  private drawToast(now: number): void {
    const alpha = Math.max(0, Math.min(1, (this.toastUntil - now) / 400));
    this.toast.setAlpha(alpha);
    this.toastBox.clear();
    if (alpha <= 0) return;
    const w = this.toast.width + 48;
    const h = 48;
    const rise = (1 - Math.min(1, (TOAST_MS - (this.toastUntil - now)) / 150)) * 10;
    this.toast.setY(190 + rise);
    this.toastBox.fillStyle(OUTLINE, 0.9 * alpha).fillRoundedRect(CANVAS.w / 2 - w / 2, 190 + rise - h / 2, w, h, 24);
  }

  /** Dim overlay with the translated result, a few characters and the given buttons. Idempotent. */
  showResult(status: 'won' | 'lost', actions: ResultAction[], clear = false): void {
    if (this.overlay.length > 0) return;
    this.closeHint();
    const scene = this.scene;
    const dim = scene.add.graphics().setDepth(20);
    dim.fillStyle(OUTLINE, 0.6).fillRect(0, 0, CANVAS.w, CANVAS.h);
    panel(dim, RESULT_PANEL, 26);
    const ribbon = { x: RESULT_PANEL.x + 40, y: RESULT_PANEL.y + 30, w: RESULT_PANEL.w - 80, h: 84 };
    dim.fillStyle(status === 'won' ? SELECTED : WARN, 1).fillRoundedRect(ribbon.x, ribbon.y, ribbon.w, ribbon.h, 20);
    dim.lineStyle(4, OUTLINE, 1).strokeRoundedRect(ribbon.x, ribbon.y, ribbon.w, ribbon.h, 20);
    // Ground the characters stand on.
    dim.fillStyle(PANEL_SHADE, 0.6).fillEllipse(CANVAS.w / 2, 420, 420, 30);

    const title = scene.add
      .text(CANVAS.w / 2, ribbon.y + ribbon.h / 2, t(status === 'won' && clear ? 'result.won.clear' : `result.${status}`), {
        fontFamily: UI_FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: INK_LIGHT,
        align: 'center',
        wordWrap: { width: ribbon.w - 40 },
      })
      .setOrigin(0.5)
      .setDepth(21);

    const cast = status === 'won' ? ['moco', 'medula_osea', 'epitelio'] : ['bacteria_gram_pos', 'bacteria_gram_pos', 'bacteria_gram_pos'];
    const figures = cast.map((id, i) => {
      const f = createFigure(scene, id, CANVAS.w / 2 + (i - 1) * 140, 424, RESULT_FIGURE_SCALE).setDepth(21).idle();
      if (status === 'won') {
        scene.tweens.add({ targets: f.root, y: 404, duration: 260, yoyo: true, repeat: -1, delay: i * 120, ease: 'Quad.easeOut' });
      } else {
        f.setMoving(true);
      }
      return f;
    });

    this.buttons = resultButtons(actions);
    const labels = this.buttons.map(({ action, rect }, i) => {
      const primary = i === 0;
      dim.fillStyle(PANEL_SHADE, 1).fillRoundedRect(rect.x, rect.y + 5, rect.w, rect.h, 18);
      dim.fillStyle(primary ? SELECTED : 0xfbf3ef, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 18);
      dim.lineStyle(4, OUTLINE, 1).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 18);
      return scene.add
        .text(rect.x + rect.w / 2, rect.y + rect.h / 2, t(`action.${action}`), {
          fontFamily: UI_FONT,
          fontSize: '28px',
          fontStyle: 'bold',
          color: primary ? INK_LIGHT : INK,
          align: 'center',
          wordWrap: { width: rect.w - 20 },
        })
        .setOrigin(0.5)
        .setDepth(21);
    });
    this.overlay = [dim, title, ...labels, ...figures];
  }
}
