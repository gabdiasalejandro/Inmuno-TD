import type Phaser from 'phaser';
import { CYTOKINE, CYTOKINE_DARK, UI_FONT, drawEnergyOrb, floatText, flyEnergy, specks } from '../game/effects';
import { createFigure, type Figure } from '../game/figures';
import type { ResultAction } from '../game/flow';
import { t } from '../i18n';
import { levelProgress } from '../game/levelView';
import { PAUSE_ACTIONS, type PauseAction } from '../game/pause';
import { TICKS_PER_SECOND, secondsToTicks, type PowerDef, type UnitDef } from '../sim';
import { fitScale, formatClock, formatGain, formatMultiplier, isSpedUp } from './format';
import {
  CANVAS,
  ENERGY_COUNTER,
  ENERGY_ICON,
  ENERGY_VALUE,
  LEFT_COLUMN,
  MARROW_FIGURE_SCALE,
  MARROW_ANCHOR,
  MARROW_LABEL,
  MARROW_CORE,
  MARROW_PANEL,
  MARROW_RING,
  HINT_BUBBLE,
  LINK_X,
  LINK_Y,
  PAUSE_PANEL,
  PAUSE_TITLE,
  RESULT_PANEL,
  TOAST_POS,
  cardSlots,
  hintTail,
  hudLayout,
  meterChips,
  pauseMenuButtons,
  pointInRect,
  resultButtons,
  type HudLayout,
  type PauseMenuButton,
  type Rect,
  type ResultButton,
} from './layout';

const INK = '#3A2A2A';
const INK_LIGHT = '#FBF7F2';
const WARN_TEXT = '#A8392F';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xf3e4e0;
const PANEL_SHADE = 0xc9a6a1;
/** The left column's own fill, a notch darker than the cards standing on it. */
const COLUMN = 0xe9d6d1;
const SELECTED = 0x7b4fa3;
const WARN = 0xb5483f;
const TIME_FILL = 0x8aa9b8;
const TIME_LOW = 0xc98a6a;
const PROGRESS = 0x8db28a;
const PROGRESS_LIGHT = 0xb9d3a8;
const INFLAMMATION = 0xe39a6c;
const INFLAMMATION_HOT = 0xc9503f;

const SHAKE_MS = 350;
const TOAST_MS = 1500;
const HINT_MS = 5200;
const ENERGY_HOT = 0xe8602c;
const ENERGY_BASE = 0xf3a23a;

function lerpHex(a: number, b: number, k: number): number {
  const mix = (shift: number): number => Math.round(((a >> shift) & 0xff) + (((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * k);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
const RESULT_FIGURE_SCALE = 0.62;

const PAUSE_LABELS: Record<PauseAction, string> = { resume: 'action.resume', restart: 'action.restart', menu: 'action.menu' };

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
  /**
   * Hold-to-release button: cytokine charge stored in the cells (points), the meter maximum it is
   * compared with, and whether the player is holding it. Null without the signal.
   */
  release: { stored: number; max: number; held: boolean } | null;
  /** Inflammation level 0..1, or null in levels without it. */
  inflammation: number | null;
  shake: { defId: string; until: number } | null;
  /** Tick from which each power can be played again. */
  powerReadyAt?: Record<string, number>;
}

const POWER_FILL = 0x7b4fa3;
const POWER_TRACK = 0xe1d9e8;
const POWER_CURRENT = 0xf7c56e;

interface PowerView {
  def: PowerDef;
  /** The button's name, and its state: the seconds left to recharge, or "Listo". */
  name: Phaser.GameObjects.Text;
  caption: Phaser.GameObjects.Text;
}

interface CardView {
  def: UnitDef;
  figure: Figure;
  name: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

/** Cytokine icon: three signal dots joined in a triangle, centred on (x, y), `scale` times its size. */
function drawCytokineIcon(g: Phaser.GameObjects.Graphics, x: number, y: number, scale: number, color: number): void {
  const p = (dx: number, dy: number): [number, number] => [x + dx * scale, y + dy * scale];
  const [a, b, c] = [p(-8, 6), p(0, -7), p(8, 6)];
  g.lineStyle(2.5 * scale, color, 1).lineBetween(a[0], a[1], b[0], b[1]).lineBetween(b[0], b[1], c[0], c[1]).lineBetween(a[0], a[1], c[0], c[1]);
  for (const [px, py] of [a, b, c]) g.fillStyle(color, 1).fillCircle(px, py, 4 * scale);
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
  private readonly powerViews: PowerView[];
  private readonly marrow: Figure;
  /** The marrow is presenting a tutorial: it animates as if talking. */
  private marrowTalking = false;
  private readonly core: Phaser.GameObjects.Graphics;
  private readonly energyValue: Phaser.GameObjects.Text;
  private readonly timeLabel: Phaser.GameObjects.Text;
  private readonly timeValue: Phaser.GameObjects.Text;
  private readonly layout: HudLayout;
  private meterBumpAt = -Infinity;
  /** Inflammation gauge: its label and the levels (0..1) where its tiers start; null without it. */
  private readonly gauge: { label: Phaser.GameObjects.Text; tiers: number[]; defeatAt: number } | null = null;
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
  private pauseOverlay: Phaser.GameObjects.GameObject[] = [];
  private pauseButtonList: PauseMenuButton[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    defs: UnitDef[],
    options: { meter: boolean; clear: boolean; gauge?: { tiers: number[]; defeatAt: number } | null; powers?: PowerDef[] },
  ) {
    const powers = options.powers ?? [];
    this.layout = hudLayout(defs.length, options.meter, powers.length);
    const { timer, meter } = this.layout;
    const statics = scene.add.graphics().setDepth(5);
    panel(statics, LEFT_COLUMN, 22, COLUMN);
    panel(statics, MARROW_PANEL, 16);
    panel(statics, timer, 16);
    if (meter) panel(statics, meter, 16);
    if (options.gauge) panel(statics, this.layout.inflammation, 16);
    this.drawPauseButton(statics);

    this.g = scene.add.graphics().setDepth(6);
    this.marrow = createFigure(scene, 'medula_osea', MARROW_ANCHOR.x, MARROW_ANCHOR.y, MARROW_FIGURE_SCALE).setDepth(6.5).idle();
    // Above the marrow figure: the batch growing inside its cavity.
    this.core = scene.add.graphics().setDepth(6.8);

    // Name tag over the marrow's feet: the one place the HUD says what produces the energy.
    const marrowName = text(scene, 12, true).setText(t('hud.marrow')).setOrigin(0.5, 0.5).setPosition(MARROW_LABEL.x, MARROW_LABEL.y);
    const tagW = marrowName.width + 12;
    const tag = scene.add.graphics().setDepth(6.9);
    tag.fillStyle(PANEL, 1).fillRoundedRect(MARROW_LABEL.x - tagW / 2, MARROW_LABEL.y - 10, tagW, 20, 10);
    tag.lineStyle(3, OUTLINE, 1).strokeRoundedRect(MARROW_LABEL.x - tagW / 2, MARROW_LABEL.y - 10, tagW, 20, 10);

    this.cards = defs.map((def, i) => ({
      def,
      figure: createFigure(scene, def.id, 0, 0, cardSlots((this.layout.cards[i] as Rect).w, (this.layout.cards[i] as Rect).h).figureScale).setDepth(6.5).idle(),
      name: text(scene, 18, true).setOrigin(0.5, 0),
      cost: text(scene, cardSlots((this.layout.cards[i] as Rect).w, (this.layout.cards[i] as Rect).h).costFont, true).setOrigin(1, 0.5),
    }));

    this.powerViews = powers.map((def) => ({
      def,
      name: text(scene, 15, true).setOrigin(0.5, 0.5),
      caption: text(scene, 14, true).setOrigin(0.5, 0.5),
    }));

    this.energyValue = text(scene, 36, true).setOrigin(0.5, 0.5).setPosition(ENERGY_VALUE.x, ENERGY_VALUE.y);
    // Label and value share one row: label left, value right, and the bar under both.
    // Clear levels have neither: only the progress bar and its little bacterium.
    const clear = options.clear;
    this.timeLabel = text(scene, 17, true)
      .setText(clear ? '' : t('hud.time_left'))
      .setVisible(!clear)
      .setOrigin(0, 0)
      .setPosition(timer.x + 16, timer.y + 9);
    this.timeValue = text(scene, 26, true)
      .setVisible(!clear)
      .setOrigin(1, 0)
      .setPosition(timer.x + timer.w - 16, timer.y + 4);
    if (meter) {
      this.chipTexts = { marrow: text(scene, 13, true).setOrigin(1, 0.5), recruit: text(scene, 13, true).setOrigin(1, 0.5) };
    }

    if (options.gauge) {
      const slot = this.layout.inflammation;
      this.gauge = { ...options.gauge, label: text(scene, 16, true).setText(t('hud.inflammation')).setPosition(slot.x + 16, slot.y + 7) };
    }

    this.toastBox = scene.add.graphics().setDepth(9);
    this.toast = text(scene, 24, true, INK_LIGHT).setOrigin(0.5, 0.5).setPosition(TOAST_POS.x, TOAST_POS.y).setDepth(10).setAlpha(0);
  }

  get cardCount(): number {
    return this.cards.length;
  }

  get powerCount(): number {
    return this.powerViews.length;
  }

  /** The power's button in the top bar, or null in levels without a power. */
  get powerRect(): Rect | null {
    return this.layout.powers[0] ?? null;
  }

  /** Id of the power at this index (the levels have one). */
  powerId(index: number): string | undefined {
    return this.powerViews[index]?.def.id;
  }

  /** Where cytokine particles should land: the middle of the meter, or null without one. */
  get meterTarget(): { x: number; y: number } | null {
    const m = this.layout.meter;
    return m ? { x: m.x + m.w / 2, y: m.y + m.h - 14 } : null;
  }

  /** The hold-to-release button, or null in levels without the meter. */
  get releaseRect(): Rect | null {
    return this.layout.release;
  }

  /** The inflammation gauge's panel, or null in levels without it. */
  get gaugeRect(): Rect | null {
    return this.gauge ? this.layout.inflammation : null;
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

  /** The marrow talks (a tutorial bubble comes out of it): livelier idle and a rhythmic swell. */
  setMarrowTalking(talking: boolean): void {
    this.marrowTalking = talking;
  }

  /** A short squeeze of the marrow, for when it starts a new line. */
  nudgeMarrow(): void {
    this.marrow.squeeze();
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
      floatText(this.scene, ENERGY_ICON.x + 30, ENERGY_ICON.y - 18, formatGain(amount), '#F7C56E', 26, 11);
    });
  }

  update(m: HudModel): void {
    const g = this.g.clear();
    const shown = Math.max(0, m.energy - this.pending);
    this.drawMarrow(g, m);
    this.drawEnergy(g, shown, m.now);
    this.cards.forEach((card, i) => this.drawCard(g, card, i, m, shown));
    this.powerViews.forEach((view) => this.drawPower(g, view, m));
    this.drawTimer(g, m);
    this.drawMeter(g, m);
    this.drawRelease(g, m);
    this.drawGauge(g, m);
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
    const talk = this.marrowTalking ? 0.5 + 0.5 * Math.sin(m.now / 120) : 0;
    this.marrow
      .setExcite(this.marrowTalking ? Math.max(excite, 0.6) : excite)
      .setSwell(0.04 * charge * charge + 0.03 * excite * throb + (this.marrowTalking ? 0.035 * talk : 0));
    const glow = charge > 0.8 ? 0.5 + 0.5 * Math.sin(m.now / 60) : 0;
    if (glow > 0) g.fillStyle(0xf7c56e, 0.25 * glow).fillCircle(x, cy, ring - 8);
    drawEnergyOrb(this.core.clear(), MARROW_CORE.x, MARROW_CORE.y, 3 + 8 * charge, 0.6 + 0.4 * charge);
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
    this.energyValue.setText(String(Math.floor(energy)));
    this.energyValue.setScale(fitScale(this.energyValue.width, ENERGY_COUNTER.w - 6) * bump);
  }

  /**
   * The power's button, beside the cytokine release button: a pill that fills from the left as it
   * recharges and turns purple and ready. Selecting it arms the power for the next click on the board.
   */
  private drawPower(g: Phaser.GameObjects.Graphics, view: PowerView, m: HudModel): void {
    const r = this.layout.powers[0];
    if (!r) return;
    const { def } = view;
    const selected = m.selected === def.id;
    const cooling = Math.max(0, (m.powerReadyAt?.[def.id] ?? 0) - m.tick);
    const total = secondsToTicks(def.cooldown);
    const ready = cooling === 0;
    const cx = r.x + r.w / 2;

    g.fillStyle(PANEL_SHADE, 1).fillRoundedRect(r.x, r.y + 4, r.w, r.h, 22);
    g.fillStyle(ready ? POWER_FILL : 0xfbf3ef, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 22);
    if (!ready && total > 0) {
      // Recharge: the filled share grows from the left.
      const share = 1 - cooling / total;
      g.fillStyle(POWER_TRACK, 1).fillRoundedRect(r.x, r.y, Math.max(22, r.w * share), r.h, 22);
    }
    g.lineStyle(selected ? 6 : 4, selected ? POWER_CURRENT : OUTLINE, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 22);

    // Icon: a rosette of four dots, the complement's four steps around one centre.
    const ink = ready ? 0xfbf7f2 : POWER_FILL;
    const rx = cx;
    const ry = r.y + r.h / 2 - 2;
    for (const [dx, dy] of [[0, -7], [7, 0], [0, 7], [-7, 0]] as const) g.fillStyle(ink, 1).fillCircle(rx + dx, ry + dy, 4);
    g.fillStyle(ink, 1).fillCircle(rx, ry, 3);
    view.name.setVisible(false);
    // Recharging: seconds left under the icon; ready: a tick, drawn rather than written.
    view.caption.setPosition(cx, r.y + r.h - 9).setColor('#3A2A2A');
    if (ready) {
      view.caption.setText('');
      const ty = r.y + r.h - 12;
      g.lineStyle(3.5, 0xfbf7f2, 1).beginPath().moveTo(cx - 7, ty).lineTo(cx - 2, ty + 5).lineTo(cx + 7, ty - 5).strokePath();
    } else {
      view.caption.setText(`${Math.ceil(cooling / TICKS_PER_SECOND)} s`);
    }
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
    const y = r.y;
    const alpha = usable ? 1 : 0.7;
    const slots = cardSlots(r.w, r.h);
    const figureX = x + slots.figureX;

    g.fillStyle(PANEL_SHADE, 1).fillRoundedRect(x, y + 4, r.w, r.h, 14);
    g.fillStyle(selected ? 0xfff6d8 : PANEL, 1).fillRoundedRect(x, y, r.w, r.h, 14);
    // Figure plinth: a soft disc the character stands on.
    g.fillStyle(PANEL_SHADE, 0.55).fillEllipse(figureX, y + slots.figureGround - 2, Math.min(64, slots.figureZone.w), 12);
    g.lineStyle(selected ? 7 : 4, selected ? SELECTED : shaking ? WARN : OUTLINE, 1);
    g.strokeRoundedRect(x, y, r.w, r.h, 14);

    card.figure.setPosition(figureX, y + slots.figureGround).setDim(!usable);

    if (cooling > 0 && cooldownTotal > 0) {
      const h = (r.h - 8) * Math.min(1, cooling / cooldownTotal);
      const radii = { tl: 10, tr: 10, bl: h > r.h - 20 ? 10 : 0, br: h > r.h - 20 ? 10 : 0 };
      g.fillStyle(boosted ? CYTOKINE_DARK : OUTLINE, boosted ? 0.45 : 0.3).fillRoundedRect(x + 4, y + 4, r.w - 8, h, radii);
      // Cytokines at work: arrows climb the card, and the cooldown edge glows, so it reads as "refilling faster".
      if (boosted) {
        g.fillStyle(CYTOKINE, 0.95).fillRect(x + 4, y + 4 + h - 3, r.w - 8, 3);
        for (let k = 0; k < 3; k++) {
          const t = ((m.now / 520 + k / 3) % 1);
          const ay = y + r.h - 12 - t * (r.h - 24);
          this.arrow(g, x + slots.figureX + 30, ay, 1 - Math.abs(t - 0.5) * 1.6);
        }
      }
    }
    if (boosted) {
      // Badge in the corner while the boost lasts, even when the card is ready.
      const bx = x + slots.badge.x;
      const by = y + slots.badge.y;
      const pulse = 0.5 + 0.5 * Math.sin(m.now / 140);
      const k = slots.badge.r / 14;
      g.fillStyle(CYTOKINE, 1).fillCircle(bx, by, (11 + pulse * 1.5) * k);
      g.lineStyle(3, OUTLINE, 1).strokeCircle(bx, by, (11 + pulse * 1.5) * k);
      g.fillStyle(0xe8fbf8, 1).fillTriangle(bx, by - 6 * k, bx - 6 * k, by + 4 * k, bx + 6 * k, by + 4 * k);
    }

    card.name.setText(t(`unit.${def.id}.name`)).setScale(fitScale(card.name.width, slots.name.w)).setPosition(x + slots.name.x + slots.name.w / 2, y + slots.name.y + 2).setAlpha(alpha);
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
    // Clear levels have no countdown and no remaining count: only how much of the level is done.
    if (m.remainingEnemies !== null) {
      this.timeLabel.setVisible(false);
      this.timeValue.setVisible(false);
      const progress = levelProgress(m.remainingEnemies, m.totalEnemies);
      this.drawProgressBar(g, { x: rect.x + 16, y: rect.y + 22, w: rect.w - 32, h: 24 }, progress, 12);
      return;
    }
    const remaining = m.remainingSeconds;
    const total = m.totalSeconds;
    const visible = remaining !== null && total !== null && total > 0;
    this.timeLabel.setVisible(visible);
    this.timeValue.setVisible(visible);
    if (!visible || remaining === null || total === null) return;
    const fraction = Math.max(0, Math.min(1, remaining / total));
    const low = remaining <= 10;
    this.timeValue.setText(formatClock(remaining));
    const bar = { x: rect.x + 16, y: rect.y + 40, w: rect.w - 32, h: 18 };
    g.fillStyle(OUTLINE, 0.14).fillRoundedRect(bar.x, bar.y, bar.w, bar.h, 9);
    const w = bar.w * fraction;
    if (w > 2) {
      const pulse = low ? 0.75 + 0.25 * Math.sin(m.now / 120) : 1;
      g.fillStyle(low ? TIME_LOW : TIME_FILL, pulse).fillRoundedRect(bar.x, bar.y, Math.max(w, 18), bar.h, 9);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, 9);
  }

  /** A soft green bar that fills as the level is cleared, with a tiny bacterium riding its edge. */
  private drawProgressBar(g: Phaser.GameObjects.Graphics, bar: Rect, progress: number, radius: number): void {
    g.fillStyle(OUTLINE, 0.14).fillRoundedRect(bar.x, bar.y, bar.w, bar.h, radius);
    if (progress > 0) {
      const w = Math.max(bar.h, Math.min(bar.w, bar.w * progress));
      g.fillStyle(PROGRESS, 1).fillRoundedRect(bar.x, bar.y, w, bar.h, radius);
      if (bar.h >= 20) g.fillStyle(PROGRESS_LIGHT, 0.5).fillRoundedRect(bar.x + 3, bar.y + 3, Math.max(w - 6, 4), 5, 2.5);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, radius);
    const size = bar.h + 2;
    const half = (size * 1.1) / 2;
    const x = Math.min(bar.x + bar.w - half, Math.max(bar.x + half, bar.x + bar.w * progress));
    this.drawMiniBacterium(g, x, bar.y + bar.h / 2, size);
  }

  /** A violet capsule with one eye and a little tail: the level's progress marker. */
  private drawMiniBacterium(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    const w = size * 1.1;
    const h = size * 0.7;
    const left = x - w / 2;
    const top = y - h / 2;
    g.lineStyle(Math.max(1.5, size * 0.07), OUTLINE, 1).lineBetween(left, y, left - size * 0.32, y - size * 0.16);
    g.fillStyle(0x7452e0, 1).fillRoundedRect(left, top, w, h, h / 2);
    g.lineStyle(Math.max(2, size * 0.12), OUTLINE, 1).strokeRoundedRect(left, top, w, h, h / 2);
    const eye = Math.max(1.2, size * 0.075);
    g.fillStyle(0xfbf7f2, 1).fillCircle(x + w * 0.14, y - h * 0.12, eye * 1.5);
    g.fillStyle(OUTLINE, 1).fillCircle(x + w * 0.16, y - h * 0.12, eye * 0.75);
  }

  /** Cytokine meter: a teal bar that bumps when particles arrive and shimmers while it is high. */
  private drawMeter(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const rect = this.layout.meter;
    const bar = this.layout.meterBar;
    if (!rect || !bar || m.cytokines === null) return;
    const level = Math.max(0, Math.min(1, m.cytokines));
    const bump = Math.max(0, 1 - (m.now - this.meterBumpAt) / 220);
    g.fillStyle(OUTLINE, 0.16).fillRoundedRect(bar.x, bar.y, bar.w, bar.h, 8);
    const w = bar.w * level;
    if (w > 2) {
      g.fillStyle(CYTOKINE, 1).fillRoundedRect(bar.x, bar.y, Math.max(w, 16), bar.h, 8);
      g.fillStyle(0xe8fbf8, 0.5).fillRoundedRect(bar.x + 3, bar.y + 2, Math.max(w, 16) - 6, 4, 2);
    }
    if (bump > 0) {
      g.lineStyle(4, CYTOKINE, bump).strokeRoundedRect(rect.x - 3 * bump, rect.y - 3 * bump, rect.w + 6 * bump, rect.h + 6 * bump, 18);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, 8);
    // Cytokine icon: teal while the meter holds any signal.
    drawCytokineIcon(g, rect.x + 30, rect.y + 18, 1, level > 0.05 ? 0x1b7f76 : 0x9c8a87);
    if (m.effects) this.drawChips(g, m.effects, rect, bar);
  }

  /**
   * Inflammation gauge: a bar split into its tiers (calm, then each collateral damage tier, darker as
   * it hurts more, defeat at the end). The marks sit where the rules change; the fill turns warm in
   * the damaging bands and throbs near defeat.
   */
  private drawGauge(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const gauge = this.gauge;
    if (!gauge || m.inflammation === null) return;
    const slot = this.layout.inflammation;
    const bar = { x: slot.x + 16, y: slot.y + 38, w: slot.w - 32, h: 16 };
    const level = Math.max(0, Math.min(1, m.inflammation / gauge.defeatAt));
    const marks = gauge.tiers.map((from) => Math.min(1, from / gauge.defeatAt));
    const harm = marks[0] ?? 1;
    // Tier bands under the fill: calm, then each damaging tier a little hotter than the last.
    g.fillStyle(OUTLINE, 0.12).fillRoundedRect(bar.x, bar.y, bar.w * harm, bar.h, { tl: 8, bl: 8, tr: 0, br: 0 });
    marks.forEach((start, i) => {
      const end = marks[i + 1] ?? 1;
      const last = i === marks.length - 1;
      g.fillStyle(INFLAMMATION_HOT, 0.22 + 0.2 * i).fillRoundedRect(bar.x + bar.w * start, bar.y, bar.w * (end - start), bar.h, {
        tl: 0,
        bl: 0,
        tr: last ? 8 : 0,
        br: last ? 8 : 0,
      });
    });
    const w = bar.w * level;
    const harming = level >= harm;
    if (w > 2) {
      const throb = level >= (marks[marks.length - 1] ?? 0.8) ? 0.75 + 0.25 * Math.sin(m.now / 90) : 1;
      g.fillStyle(harming ? INFLAMMATION_HOT : INFLAMMATION, throb).fillRoundedRect(bar.x, bar.y, Math.max(w, 16), bar.h, 8);
      g.fillStyle(0xfbe3d6, 0.5).fillRoundedRect(bar.x + 3, bar.y + 2, Math.max(w, 16) - 6, 4, 2);
    }
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(bar.x, bar.y, bar.w, bar.h, 8);
    // A mark where each damage tier begins, and a little flame at the end where the level is lost.
    for (const mark of marks) {
      const x = bar.x + bar.w * mark;
      g.lineStyle(3, OUTLINE, 1).lineBetween(x, bar.y - 6, x, bar.y + bar.h + 4);
    }
    const ex = bar.x + bar.w;
    g.fillStyle(WARN, 1).fillTriangle(ex - 7, bar.y - 2, ex + 7, bar.y - 2, ex, bar.y - 16);
    g.lineStyle(2, OUTLINE, 1).strokeTriangle(ex - 7, bar.y - 2, ex + 7, bar.y - 2, ex, bar.y - 16);
    gauge.label.setColor(harming ? WARN_TEXT : INK);
  }

  /**
   * Hold-to-release button. Its teal fill shows how much charge the cells hold (against the
   * meter's maximum, the most one hold can matter); it sinks while held and greys out when empty.
   */
  private drawRelease(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const rect = this.layout.release;
    if (!rect || !m.release) return;
    const { stored, max, held } = m.release;
    const ready = stored >= 0.5;
    const sink = held ? 4 : 0;
    const r = { ...rect, y: rect.y + sink };
    if (!held) g.fillStyle(PANEL_SHADE, 1).fillRoundedRect(r.x, r.y + 4, r.w, r.h, 22);
    g.fillStyle(held ? 0xd7ece9 : 0xfbf3ef, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 22);
    const share = Math.max(0, Math.min(1, stored / max));
    if (share > 0) {
      const glow = held ? 0.55 + 0.25 * Math.sin(m.now / 90) : 0.4;
      g.fillStyle(CYTOKINE, glow).fillRoundedRect(r.x + 4, r.y + 4, Math.max(18, (r.w - 8) * share), r.h - 8, 18);
    }
    g.lineStyle(held ? 5 : 4, held ? CYTOKINE_DARK : OUTLINE, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 22);
    // The cytokine icon at the button's centre, in ink when charge is stored and grey when it is not.
    drawCytokineIcon(g, r.x + r.w / 2, r.y + r.h / 2, 1.5, ready ? 0x3a2a2a : 0x9c8a87);
  }

  /** Two chips under the label: what the meter does right now. Idle (grey) at x1, teal when it speeds things up. */
  private drawChips(g: Phaser.GameObjects.Graphics, effects: { marrow: number; recruit: number }, meter: Rect, bar: Rect): void {
    const chips = meterChips(meter, bar);
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
   * A thin teal line ties the meter to the things it speeds up: it runs along the gap under the
   * top bar, then down the gap beside the left column to the marrow panel and every card whose
   * redeploy is boosted. Only while the multipliers are above x1.
   */
  private drawLinks(g: Phaser.GameObjects.Graphics, m: HudModel): void {
    const meter = this.layout.meter;
    if (!meter || !m.effects) return;
    const marrowOn = isSpedUp(m.effects.marrow);
    const cards = this.layout.cards.filter((_, i) => m.boosted.has(this.cards[i]?.def.id ?? ''));
    if (!marrowOn && cards.length === 0) return;
    const meterX = meter.x + 24;
    const columnEdge = LEFT_COLUMN.x + LEFT_COLUMN.w;
    const stubs: number[] = [];
    if (marrowOn) stubs.push(MARROW_PANEL.y + MARROW_PANEL.h / 2);
    for (const c of cards) stubs.push(c.y + c.h / 2);
    g.lineStyle(3, CYTOKINE, 0.85);
    g.lineBetween(meterX, meter.y + meter.h, meterX, LINK_Y);
    g.lineBetween(LINK_X, LINK_Y, meterX, LINK_Y);
    g.lineBetween(LINK_X, LINK_Y, LINK_X, Math.max(...stubs));
    g.fillStyle(CYTOKINE, 0.85).fillCircle(meterX, meter.y + meter.h, 4);
    for (const y of stubs) {
      g.lineBetween(columnEdge, y, LINK_X, y);
      g.fillStyle(CYTOKINE, 0.85).fillCircle(columnEdge, y, 4);
    }
    if (marrowOn) g.lineStyle(4, CYTOKINE, 0.7).strokeRoundedRect(MARROW_PANEL.x - 3, MARROW_PANEL.y - 3, MARROW_PANEL.w + 6, MARROW_PANEL.h + 6, 19);
    for (const c of cards) g.lineStyle(4, CYTOKINE, 0.7).strokeRoundedRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, 17);
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
    if (!this.overHint(x, y)) return false;
    this.closeHint();
    return true;
  }

  /** True when the point is over the visible hint, without closing it (for the cursor). */
  overHint(x: number, y: number): boolean {
    if (!this.hint) return false;
    const meter = this.layout.meter;
    const h = Math.max(HINT_BUBBLE.h, 40 + this.hint.body.height + 14);
    const onTail = meter ? Math.abs(x - hintTail(meter).tipX) < 24 && y >= meter.y + meter.h && y <= HINT_BUBBLE.y : false;
    return pointInRect({ ...HINT_BUBBLE, h }, x, y) || onTail;
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

  /** Pause button: two bars, centred in its square. */
  private drawPauseButton(g: Phaser.GameObjects.Graphics): void {
    const r = this.layout.pause;
    panel(g, r, 16);
    const barW = 10;
    const barH = 32;
    const gap = 8;
    const left = r.x + (r.w - (2 * barW + gap)) / 2;
    const top = r.y + (r.h - barH) / 2;
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(left, top, barW, barH, 3).fillRoundedRect(left + barW + gap, top, barW, barH, 3);
  }

  /** The pause button's rectangle, for hit tests. */
  get pauseRect(): Rect {
    return this.layout.pause;
  }

  /** Buttons of the pause panel currently on screen (empty while not paused). */
  get pauseButtons(): PauseMenuButton[] {
    return this.pauseButtonList;
  }

  /** Dim overlay with a centred panel: "Pausa" and its buttons. Idempotent. */
  showPause(): void {
    if (this.pauseOverlay.length > 0) return;
    const scene = this.scene;
    const dim = scene.add.graphics().setDepth(20);
    dim.fillStyle(OUTLINE, 0.6).fillRect(0, 0, CANVAS.w, CANVAS.h);
    panel(dim, PAUSE_PANEL, 26);
    const title = scene.add
      .text(PAUSE_TITLE.x, PAUSE_TITLE.y, t('action.pause'), { fontFamily: UI_FONT, fontSize: '44px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(21);
    this.pauseButtonList = pauseMenuButtons(PAUSE_ACTIONS);
    const labels = this.pauseButtonList.map(({ action, rect }) => {
      const primary = action === 'resume';
      dim.fillStyle(PANEL_SHADE, 1).fillRoundedRect(rect.x, rect.y + 5, rect.w, rect.h, 18);
      dim.fillStyle(primary ? SELECTED : 0xfbf3ef, 1).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 18);
      dim.lineStyle(4, OUTLINE, 1).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 18);
      return scene.add
        .text(rect.x + rect.w / 2, rect.y + rect.h / 2, t(PAUSE_LABELS[action]), {
          fontFamily: UI_FONT,
          fontSize: '30px',
          fontStyle: 'bold',
          color: primary ? INK_LIGHT : INK,
        })
        .setOrigin(0.5)
        .setDepth(21);
    });
    this.pauseOverlay = [dim, title, ...labels];
  }

  hidePause(): void {
    for (const o of this.pauseOverlay) o.destroy();
    this.pauseOverlay = [];
    this.pauseButtonList = [];
  }

  private drawToast(now: number): void {
    const alpha = Math.max(0, Math.min(1, (this.toastUntil - now) / 400));
    this.toast.setAlpha(alpha);
    this.toastBox.clear();
    if (alpha <= 0) return;
    const w = this.toast.width + 48;
    const h = 48;
    const rise = (1 - Math.min(1, (TOAST_MS - (this.toastUntil - now)) / 150)) * 10;
    this.toast.setY(TOAST_POS.y + rise);
    this.toastBox.fillStyle(OUTLINE, 0.9 * alpha).fillRoundedRect(TOAST_POS.x - w / 2, TOAST_POS.y + rise - h / 2, w, h, 24);
  }

  /** Dim overlay with the translated result, a few characters and the given buttons. Idempotent. */
  showResult(status: 'won' | 'lost', actions: ResultAction[], clear = false, lostKey = 'result.lost'): void {
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
      .text(CANVAS.w / 2, ribbon.y + ribbon.h / 2, t(status === 'won' ? (clear ? 'result.won.clear' : 'result.won') : lostKey), {
        fontFamily: UI_FONT,
        fontSize: '32px',
        fontStyle: 'bold',
        color: INK_LIGHT,
        align: 'center',
        wordWrap: { width: ribbon.w - 40 },
      })
      .setOrigin(0.5)
      .setDepth(21);

    const cast =
      status === 'won'
        ? ['moco', 'medula_osea', 'epitelio']
        : lostKey === 'result.lost'
          ? ['bacteria_gram_pos', 'bacteria_gram_pos', 'bacteria_gram_pos']
          : // Lost to the body's own response: the own cells, worn out.
            ['neutrofilo', 'epitelio', 'macrofago'];
    const figures = cast.map((id, i) => {
      const f = createFigure(scene, id, CANVAS.w / 2 + (i - 1) * 140, 424, RESULT_FIGURE_SCALE).setDepth(21).idle();
      if (status === 'lost' && lostKey !== 'result.lost') {
        f.setWear(1, scene.time.now);
      } else if (status === 'won') {
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
