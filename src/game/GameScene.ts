import Phaser from 'phaser';
import { content, levelIntros, levels, worlds } from '../data';
import { t } from '../i18n';
import {
  SIM_TICK_MS,
  TICKS_PER_SECOND,
  createSim,
  secondsToTicks,
  type EnemyDef,
  type LevelDef,
  type PlaceFailure,
  type Sim,
  type SimEvent,
  type UnitDef,
} from '../sim';
import { Hud } from '../ui/Hud';
import { IntroCard } from '../ui/IntroCard';
import { createFullscreenButton, type FullscreenButton } from '../ui/FullscreenButton';
import { HUD_FULLSCREEN } from '../ui/fullscreenLayout';
import { cardAt, hudLayout, introHit, pointInRect, resultButtonAt } from '../ui/layout';
import { CYTOKINE, banner, flyParticle, ring, specks } from './effects';
import { BOARD_SCALE, createFigure, frontOffset, type Figure } from './figures';
import { createStepper, type Stepper } from './fixedStep';
import { nextLevelId, resultActions } from './flow';
import { boardRight, cellCenter, createBoardLayout, enemyFrontX, isCellFree, pixelToCell, type BoardLayout, type Cell } from './layout';
import { shouldShowIntro } from './intro';
import { bacteriaRemaining, cytokineEffects, cytokineHintDue, digestFraction, isClearLevel, isRecruitBoosted, scheduledEnemies, shownSignalNames } from './levelView';
import { marrowCharge, marrowExcitement } from './marrow';
import { progressStore } from './progress';
import { preloadSprites } from './sprites';

/** Longest catch-up per frame: 5 steps = 250 ms of simulated time. */
const MAX_STEPS_PER_FRAME = 5;

const OUTLINE = 0x3a2a2a;
// Board: muted pink tissue with very low contrast between cells (style guide, section 6).
const MATRIX = 0xd2aca7;
const CELL_A = 0xe1c3be;
const CELL_B = 0xdec0bb;
const CELL_NUCLEUS = 0xcfa9a5;
const VESSEL = 0xcf9a98;
const VESSEL_EDGE = 0xb98682;
// Barrier at the right edge of each lane: epithelial lining, same palette as the epitelio sprite.
const LINING = 0xedb07f;
const LINING_SHADE = 0xcf8a5a;
const LINING_NUCLEUS = 0x7b4fa3;
const WOUND = 0x8a3b3b;
const WOUND_DEEP = 0x5e2426;
const WOUND_RING = 0xb5483f;
const HIGHLIGHT = 0x7b4fa3;
const BAR_BACK = 0x3a2a2a;
const BAR_OK = 0x8db28a;
const BAR_LOW = 0xb5483f;
const BAR_TIME = 0x8aa9b8;

/** Vertical gap between a cell's bottom edge and the figure's ground point. */
const FOOT_INSET = 8;
const FLASH_MS = 400;
const BARRIER_W = 44;
const CANVAS_CENTER_X = 640;
/** Seconds-of-feel between cytokine particles from one alarmed macrophage. */
const PARTICLE_GAP_MS = 170;
/** Where a swallowed bacterium is pulled to, relative to the phagocyte's ground point. */
const MOUTH = { dx: 24, dy: -42 };

export interface GameSceneData {
  levelId: string;
  /** True when restarting the same level from the result screen: skips the concept card. */
  retry?: boolean;
}

/** Small deterministic hash so the tissue texture looks irregular but never changes. */
function noise(i: number, j: number, k: number): number {
  const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

export class GameScene extends Phaser.Scene {
  private levelId = '1-1';
  private level!: LevelDef;
  private sim!: Sim;
  private layout!: BoardLayout;
  private stepper!: Stepper;
  private hud!: Hud;
  private fullscreen: FullscreenButton | null = null;
  private lanesG!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private barsG!: Phaser.GameObjects.Graphics;
  private unitDefs = new Map<string, UnitDef>();
  private enemyDefs = new Map<string, EnemyDef>();
  /** Enemy positions before the most recent step, for smooth rendering between ticks. */
  private prevPos = new Map<number, number>();
  private alpha = 0;
  private selected: string | null = null;
  private hover: Cell | null = null;
  private cardShake: { defId: string; until: number } | null = null;
  private cellFlash: (Cell & { until: number }) | null = null;
  private unitViews = new Map<number, Figure>();
  private enemyViews = new Map<number, Figure>();
  private deathCause = new Map<number, 'killed' | 'expired'>();
  private ghost: Figure | null = null;
  private resultShown = false;
  private retry = false;
  /** The meter's one-time explanation was already shown in this play. */
  private cytokineHintShown = false;
  private phase: 'intro' | 'play' = 'play';
  private introCard: IntroCard | null = null;
  private defeated = 0;
  private signalNames: string[] = [];
  private nextParticleAt = new Map<number, number>();

  constructor() {
    super('game');
  }

  init(data: Partial<GameSceneData>): void {
    this.levelId = data?.levelId ?? '1-1';
    this.retry = data?.retry ?? false;
    // Scene instances are reused on restart: every play explains the meter again.
    this.cytokineHintShown = false;
  }

  preload(): void {
    preloadSprites(this);
  }

  create(): void {
    const level = levels[this.levelId];
    if (!level) throw new Error(`Unknown level ${this.levelId}`);
    this.level = level;

    this.sim = createSim(level, content, (Math.random() * 2 ** 31) >>> 0);
    this.layout = createBoardLayout(level.grid.rows, level.grid.cols);
    this.stepper = createStepper(SIM_TICK_MS, MAX_STEPS_PER_FRAME);
    this.unitDefs = new Map(content.units.map((d) => [d.id, d]));
    this.enemyDefs = new Map(content.enemies.map((d) => [d.id, d]));
    this.prevPos = new Map();
    this.alpha = 0;
    this.selected = null;
    this.hover = null;
    this.cardShake = null;
    this.cellFlash = null;
    this.unitViews = new Map();
    this.enemyViews = new Map();
    this.deathCause = new Map();
    this.ghost = null;
    this.resultShown = false;
    this.defeated = 0;
    this.signalNames = shownSignalNames(level, content.signals, content.units);
    this.nextParticleAt = new Map();
    this.introCard = null;

    this.drawBoard();
    this.lanesG = this.add.graphics().setDepth(1);
    this.cursorG = this.add.graphics().setDepth(1.5);
    this.barsG = this.add.graphics().setDepth(4.5);
    const deck = level.deck.map((id) => this.unitDefs.get(id)).filter((d): d is UnitDef => d !== undefined);
    this.hud = new Hud(this, deck, { meter: this.signalNames.length > 0, clear: isClearLevel(level) });
    // Above the result overlay and the concept card, so the player can still toggle it there.
    this.fullscreen = createFullscreenButton(this, HUD_FULLSCREEN, { fill: 0xf3e4e0, shade: 0xc9a6a1, depth: 22 });

    // The concept card holds the simulation until the player starts; a retry goes straight to play.
    const intro = levelIntros[this.levelId];
    if (intro && shouldShowIntro(intro, this.retry)) {
      this.phase = 'intro';
      this.introCard = new IntroCard(this, intro);
    } else {
      this.beginPlay();
    }

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.fullscreen?.destroy();
      this.fullscreen = null;
    });
  }

  update(_time: number, delta: number): void {
    const state = this.sim.state;
    if (state.status === 'playing' && this.phase === 'play') {
      const { steps, alpha } = this.stepper.advance(delta);
      this.alpha = alpha;
      for (let i = 0; i < steps && this.sim.state.status === 'playing'; i++) {
        this.prevPos = new Map(state.enemies.map((e) => [e.uid, e.pos]));
        this.handleEvents(this.sim.step());
      }
    }
    if (state.status !== 'playing' && !this.resultShown) {
      this.alpha = 1;
      this.resultShown = true;
      this.selected = null;
      const next = nextLevelId(this.levelId, worlds, levels);
      this.hud.showResult(state.status, resultActions(state.status, next), isClearLevel(this.level));
    }
    this.render(this.time.now);
  }

  /** Closes the concept card (if any) and starts the clock with the level's banner. */
  private beginPlay(): void {
    this.phase = 'play';
    this.introCard?.destroy();
    this.introCard = null;
    const intro = levelIntros[this.levelId];
    if (!intro) return;
    const { layout } = this;
    banner(this, t(intro.banner), CANVAS_CENTER_X, layout.y + (layout.rows * layout.cellH) / 2);
  }

  private handleEvents(events: SimEvent[]): void {
    const { layout } = this;
    const died = new Set(events.flatMap((e) => (e.type === 'enemy_died' ? [e.uid] : [])));
    for (const event of events) {
      switch (event.type) {
        case 'energy_gained':
          this.hud.produce(event.amount);
          break;
        case 'wound_opened': {
          const { y } = cellCenter(layout, event.lane, 0);
          const x = boardRight(layout) + BARRIER_W / 2 + 4;
          ring(this, x, y, WOUND_RING, 20, 110, 700);
          ring(this, x, y, WOUND_RING, 10, 70, 500);
          specks(this, x, y, LINING, 7);
          this.cameras.main.shake(180, 0.004);
          break;
        }
        case 'enemy_attacked': {
          this.enemyViews.get(event.uid)?.attack();
          const target = this.sim.state.units.find((u) => u.uid === event.target);
          this.unitViews.get(event.target)?.hit();
          if (target) {
            const { x, y } = cellCenter(layout, target.row, target.col);
            specks(this, x + layout.cellW * 0.32, y + 6, LINING, 3);
          }
          break;
        }
        case 'unit_attacked': {
          const attacker = this.sim.state.units.find((u) => u.uid === event.uid);
          const swallows = attacker && this.unitDefs.get(attacker.defId)?.attack?.type === 'fagocitosis' && died.has(event.target);
          const prey = this.enemyViews.get(event.target);
          if (swallows && attacker) {
            // Phagocytosis: the phagocyte lunges and the bacterium is pulled into it and shrinks away.
            this.unitViews.get(event.uid)?.engulf();
            if (prey) {
              const { x, y } = cellCenter(layout, attacker.row, attacker.col);
              const foot = y + layout.cellH / 2 - FOOT_INSET;
              this.enemyViews.delete(event.target);
              this.reachFor(prey, x + MOUTH.dx, foot + MOUTH.dy);
              prey.engulfedInto(x + MOUTH.dx, foot + MOUTH.dy);
              this.time.delayedCall(300, () => specks(this, x + MOUTH.dx, foot + MOUTH.dy, 0x9e86f2, 4));
            }
          } else {
            prey?.hit();
          }
          break;
        }
        case 'enemy_died':
          this.defeated++;
          break;
        case 'unit_died':
          this.deathCause.set(event.uid, event.cause);
          break;
        case 'won':
          progressStore().markCompleted(this.levelId);
          break;
        default:
          break;
      }
    }
  }

  // ---- input ----

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const { worldX: x, worldY: y } = p;
    if (this.fullscreen?.hit(x, y)) {
      this.fullscreen.toggle();
      return;
    }
    if (this.phase === 'intro') {
      if (introHit(x, y) === 'start') this.beginPlay();
      return;
    }
    if (this.sim.state.status !== 'playing') {
      const action = resultButtonAt(this.hud.resultButtons, x, y);
      if (action === 'retry') this.scene.restart({ levelId: this.levelId, retry: true });
      else if (action === 'menu') this.scene.start('menu');
      else if (action === 'next') {
        const next = nextLevelId(this.levelId, worlds, levels);
        if (next) this.scene.restart({ levelId: next });
      }
      return;
    }
    if (this.hud.tapHint(x, y)) return;
    if (pointInRect(hudLayout(this.hud.cardCount, this.signalNames.length > 0).menu, x, y)) {
      this.scene.start('menu');
      return;
    }
    const cardIndex = cardAt(x, y, this.hud.cardCount);
    if (cardIndex !== null) {
      const id = this.hud.cardId(cardIndex) ?? null;
      this.selected = this.selected === id ? null : id;
      return;
    }
    const cell = pixelToCell(this.layout, x, y);
    this.hover = cell;
    if (cell && this.selected) this.tryPlace(this.selected, cell);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    this.hover = pixelToCell(this.layout, p.worldX, p.worldY);
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    // A finger leaves no hover; a mouse keeps it.
    if (p.wasTouch) this.hover = null;
  }

  private tryPlace(defId: string, cell: Cell): void {
    const result = this.sim.placeUnit(defId, cell.row, cell.col);
    if (result.ok) {
      this.selected = null;
      return;
    }
    this.giveFeedback(result.reason, defId, cell);
  }

  private giveFeedback(reason: PlaceFailure, defId: string, cell: Cell): void {
    const now = this.time.now;
    if (reason === 'insufficient_energy' || reason === 'on_cooldown') {
      this.cardShake = { defId, until: now + FLASH_MS };
    } else {
      this.cellFlash = { ...cell, until: now + FLASH_MS };
    }
    this.hud.showToast(t(`feedback.${reason}`), now);
  }

  /** Whether `defId` could be placed on `cell` right now (for the preview only; the sim decides). */
  private canPlace(defId: string, cell: Cell): boolean {
    const { state } = this.sim;
    const def = this.unitDefs.get(defId);
    if (!def) return false;
    return isCellFree(state.units, cell) && state.energy >= def.cost && state.tick >= (state.deployReadyAt[defId] ?? 0);
  }

  // ---- rendering ----

  /** Static tissue: rounded cells with faint nuclei over darker matrix, and a vessel on the left. */
  private drawBoard(): void {
    const { x, y, cellW, cellH, rows, cols } = this.layout;
    const g = this.add.graphics().setDepth(0);
    const w = cols * cellW;
    const h = rows * cellH;
    g.fillStyle(MATRIX, 1).fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 18);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = x + c * cellW;
        const cy = y + r * cellH;
        const j = (k: number): number => (noise(r, c, k) - 0.5) * 6;
        g.fillStyle((r + c) % 2 === 0 ? CELL_A : CELL_B, 1);
        g.fillRoundedRect(cx + 4 + j(1), cy + 4 + j(2), cellW - 8 + j(3), cellH - 8 + j(4), 22);
        // One faint nucleus per cell, off-centre, plus a couple of granules.
        const nx = cx + cellW * (0.25 + 0.5 * noise(r, c, 5));
        const ny = cy + cellH * (0.3 + 0.4 * noise(r, c, 6));
        g.fillStyle(CELL_NUCLEUS, 0.55).fillEllipse(nx, ny, 22 + j(7) * 2, 14 + j(8));
        g.fillStyle(CELL_NUCLEUS, 0.4).fillCircle(cx + cellW * noise(r, c, 9), cy + cellH * noise(r, c, 10), 3);
      }
    }
    // A capillary down the left: the inside of the body, where the marrow's cells arrive from.
    g.fillStyle(VESSEL, 1).fillRoundedRect(16, y + 4, 30, h - 8, 15);
    g.lineStyle(3, VESSEL_EDGE, 1).strokeRoundedRect(16, y + 4, 30, h - 8, 15);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(0xc8575c, 0.55).fillEllipse(31 + (noise(i, 1, 1) - 0.5) * 8, y + 30 + i * (h - 60) / 8, 14, 9);
    }
  }

  private render(now: number): void {
    const { state } = this.sim;
    const { layout } = this;
    this.drawLanes(now);
    this.drawCursor(now);
    const bars = this.barsG.clear();

    // Units: create on placement (with a pop), update, and play an exit when they leave the sim.
    const liveUnits = new Set<number>();
    for (const unit of state.units) {
      liveUnits.add(unit.uid);
      const def = this.unitDefs.get(unit.defId);
      const { x, y } = cellCenter(layout, unit.row, unit.col);
      const foot = y + layout.cellH / 2 - FOOT_INSET;
      let view = this.unitViews.get(unit.uid);
      if (!view) {
        view = createFigure(this, unit.defId, x, foot).setDepth(2 + unit.row * 0.1).idle().pop();
        this.unitViews.set(unit.uid, view);
      }
      view.setPosition(x, foot);
      if (!def) continue;
      // Detection: the receptors glow, and with a cytokine meter in play the macrophage sends
      // small particles up to it. Digestion: a bite leaves the phagocyte full for a while.
      view.setAlarm(unit.alarmed, now);
      if (def.attack?.type === 'fagocitosis') view.setDigest(digestFraction(unit.attackReadyAt, state.tick, def.attack.rate), now);
      if (unit.alarmed && def.emits && this.signalNames.includes(def.emits.signal)) this.emitCytokine(unit.uid, x + 36, foot - 80, now);
      const barW = layout.cellW * 0.56;
      if (def.lifespan !== undefined) {
        const lifeLeft = Math.max(0, 1 - (state.tick - unit.bornAt) / secondsToTicks(def.lifespan));
        view.setWear(1 - lifeLeft, now);
        this.drawBar(bars, x - barW / 2, foot + 1, barW, 5, lifeLeft, BAR_TIME);
      } else if (unit.hp < def.hp) {
        this.drawBar(bars, x - barW / 2, foot - 2, barW, 7, unit.hp / def.hp, unit.hp / def.hp < 0.35 ? BAR_LOW : BAR_OK);
      }
    }
    for (const [uid, view] of this.unitViews) {
      if (liveUnits.has(uid)) continue;
      const cause = this.deathCause.get(uid) ?? 'killed';
      if (cause === 'killed') specks(this, view.root.x, view.root.y - 40, LINING, 6);
      view.die(cause);
      this.unitViews.delete(uid);
      this.deathCause.delete(uid);
    }

    const liveEnemies = new Set<number>();
    for (const enemy of state.enemies) {
      liveEnemies.add(enemy.uid);
      const prev = this.prevPos.get(enemy.uid) ?? enemy.pos;
      const pos = prev + (enemy.pos - prev) * this.alpha;
      const { y } = cellCenter(layout, enemy.lane, 0);
      const foot = y + layout.cellH / 2 - FOOT_INSET;
      const x = enemyFrontX(layout, pos) + frontOffset(enemy.defId) * BOARD_SCALE;
      let view = this.enemyViews.get(enemy.uid);
      if (!view) {
        view = createFigure(this, enemy.defId, x, foot).setDepth(2.05 + enemy.lane * 0.1).idle().pop();
        this.enemyViews.set(enemy.uid, view);
      }
      view.setPosition(x, foot).setMoving(enemy.pos !== prev);
      const def = this.enemyDefs.get(enemy.defId);
      if (def && enemy.hp < def.hp) this.drawBar(bars, x - 30, foot - 70, 60, 6, enemy.hp / def.hp, BAR_LOW);
    }
    for (const [uid, view] of this.enemyViews) {
      if (liveEnemies.has(uid)) continue;
      specks(this, view.root.x, view.root.y - 25, 0x7452e0, 6);
      view.die('killed');
      this.enemyViews.delete(uid);
    }

    const total = this.level.win?.type === 'survive' ? this.level.win.seconds : null;
    const cytokines = this.signalNames.length > 0 ? this.sim.signal(this.signalNames[0] as string) : null;
    if (cytokineHintDue(cytokines, this.cytokineHintShown)) {
      this.cytokineHintShown = true;
      this.hud.showCytokineHint(this.time.now);
    }
    this.hud.update({
      now,
      tick: state.tick,
      energy: state.energy,
      deployReadyAt: state.deployReadyAt,
      selected: this.selected,
      remainingSeconds: total === null ? null : Math.max(0, total - state.tick / TICKS_PER_SECOND),
      totalSeconds: total,
      remainingEnemies: isClearLevel(this.level) ? bacteriaRemaining(this.level, this.defeated) : null,
      totalEnemies: scheduledEnemies(this.level),
      charge: marrowCharge(this.sim.marrowFraction()),
      excite: marrowExcitement(cytokines ?? 0),
      cytokines,
      effects: cytokines === null ? null : cytokineEffects(content.signals, this.signalNames, this.sim.signal),
      boosted: new Set(
        [...this.unitDefs.values()].filter((d) => isRecruitBoosted(d, content.signals, this.signalNames, this.sim.signal)).map((d) => d.id),
      ),
      shake: this.cardShake,
    });
  }

  /** A pseudopod stretches from the phagocyte's mouth to the prey and retracts with it. */
  private reachFor(prey: Figure, mx: number, my: number): void {
    const g = this.add.graphics().setDepth(2.04);
    const start = { x: prey.root.x, y: prey.root.y - 22 };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 340,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        const px = start.x + (mx - start.x) * k;
        const py = start.y + (my - start.y) * k;
        g.clear();
        g.lineStyle(20 * (1 - 0.4 * k), OUTLINE, 1).lineBetween(mx, my, px, py);
        g.lineStyle(11 * (1 - 0.4 * k), 0xe1d9e8, 1).lineBetween(mx, my, px, py);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** One cytokine particle from an alarmed macrophage to the HUD meter, at most one per gap. */
  private emitCytokine(uid: number, x: number, y: number, now: number): void {
    const target = this.hud.meterTarget;
    if (!target || now < (this.nextParticleAt.get(uid) ?? 0)) return;
    this.nextParticleAt.set(uid, now + PARTICLE_GAP_MS);
    flyParticle(this, { x, y }, target, CYTOKINE, () => this.hud.bumpMeter(this.time.now));
  }

  /** Target cell while a card is selected: a ghost of the unit if it fits, a refusal mark if not. */
  private drawCursor(now: number): void {
    const g = this.cursorG.clear();
    const { layout } = this;
    const showGhost = this.selected !== null && this.hover !== null && this.sim.state.status === 'playing';
    if (this.ghost && (!showGhost || this.ghost.defId !== this.selected)) {
      this.ghost.destroy();
      this.ghost = null;
    }
    if (this.cellFlash && now < this.cellFlash.until) {
      const { x, y } = cellCenter(layout, this.cellFlash.row, this.cellFlash.col);
      g.lineStyle(6, WOUND_RING, 1).strokeRoundedRect(x - layout.cellW / 2 + 4, y - layout.cellH / 2 + 4, layout.cellW - 8, layout.cellH - 8, 20);
    }
    if (!showGhost || !this.selected || !this.hover) return;
    const { x, y } = cellCenter(layout, this.hover.row, this.hover.col);
    const left = x - layout.cellW / 2 + 4;
    const top = y - layout.cellH / 2 + 4;
    const w = layout.cellW - 8;
    const h = layout.cellH - 8;
    if (this.canPlace(this.selected, this.hover)) {
      const pulse = 0.75 + 0.25 * Math.sin(now / 160);
      g.fillStyle(0xfbf7f2, 0.3).fillRoundedRect(left, top, w, h, 20);
      g.lineStyle(5, HIGHLIGHT, pulse).strokeRoundedRect(left, top, w, h, 20);
      if (!this.ghost) this.ghost = createFigure(this, this.selected, x, y).setAlpha(0.5).setDepth(1.6);
      this.ghost.setPosition(x, y + layout.cellH / 2 - FOOT_INSET).setVisible(true);
    } else {
      this.ghost?.setVisible(false);
      g.fillStyle(WOUND_RING, 0.14).fillRoundedRect(left, top, w, h, 20);
      g.lineStyle(5, WOUND_RING, 0.9).strokeRoundedRect(left, top, w, h, 20);
      // "Not here": a circle with a slash in the top corner of the cell.
      const ix = left + w - 20;
      const iy = top + 20;
      g.fillStyle(0xfbf7f2, 0.95).fillCircle(ix, iy, 14);
      g.lineStyle(4, WOUND_RING, 1).strokeCircle(ix, iy, 14);
      g.lineBetween(ix - 9, iy + 9, ix + 9, iy - 9);
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fraction: number, color: number): void {
    g.fillStyle(BAR_BACK, 0.85).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
    const fw = w * Math.max(0, Math.min(1, fraction));
    if (fw > 1) g.fillStyle(color, 1).fillRoundedRect(x, y, fw, h, Math.min(h / 2, fw / 2));
  }

  /**
   * Right edge of every lane: an intact epithelial lining while closed; once a wound opens, a torn
   * breach and a reddened trail across the lane showing where bacteria pour in.
   */
  private drawLanes(now: number): void {
    const g = this.lanesG.clear();
    const { layout } = this;
    const right = boardRight(layout);
    const x0 = right + 4;
    for (let lane = 0; lane < layout.rows; lane++) {
      const top = layout.y + lane * layout.cellH;
      const open = this.sim.state.openLanes.includes(lane);
      const cells = 3;
      const ch = (layout.cellH - 4) / cells;
      if (!open) {
        for (let i = 0; i < cells; i++) this.liningCell(g, x0, top + 2 + i * ch, BARRIER_W, ch);
        continue;
      }
      // Reddened trail along the open lane, strongest at the breach.
      const steps = 24;
      for (let k = 0; k < steps; k++) {
        const w = (right - layout.x) * (1 - k / steps);
        g.fillStyle(WOUND, 0.009).fillRect(right - w, top + 6, w, layout.cellH - 12);
      }
      // Torn lining: the outer cells are pushed apart, leaving a ragged dark gap.
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      this.liningCell(g, x0 + 4, top - 4, BARRIER_W - 8, ch * 0.75);
      this.liningCell(g, x0 + 4, top + layout.cellH - ch * 0.75 + 4, BARRIER_W - 8, ch * 0.75);
      const gy0 = top + ch * 0.75 - 2;
      const gy1 = top + layout.cellH - ch * 0.75 + 6;
      const pts = [
        [x0 + BARRIER_W + 6, gy0 - 4],
        [x0 + 18, gy0 + 6],
        [x0 + 2, gy0 + 14],
        [x0 - 10, (gy0 + gy1) / 2],
        [x0 + 2, gy1 - 14],
        [x0 + 18, gy1 - 6],
        [x0 + BARRIER_W + 6, gy1 + 4],
      ].map(([px, py]) => new Phaser.Math.Vector2(px, py));
      g.fillStyle(WOUND_RING, 1).fillPoints(pts, true);
      const inner = pts.map((p) => new Phaser.Math.Vector2(p.x + (x0 + BARRIER_W - p.x) * 0.18, p.y + ((gy0 + gy1) / 2 - p.y) * 0.22));
      g.fillStyle(WOUND, 1).fillPoints(inner, true);
      g.fillStyle(WOUND_DEEP, 0.6 + 0.3 * pulse).fillEllipse(x0 + 22, (gy0 + gy1) / 2, 30, (gy1 - gy0) * 0.6);
      g.lineStyle(4, OUTLINE, 1).strokePoints(pts, true);
    }
  }

  /** One cuboid epithelial cell of the lining, with microvilli toward the outside (right). */
  private liningCell(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    for (let i = 0; i < 3; i++) g.fillStyle(LINING_SHADE, 1).fillCircle(x + w + 1, y + h * (0.25 + i * 0.25), 4);
    g.fillStyle(LINING, 1).fillRoundedRect(x, y + 1, w, h - 2, 8);
    g.fillStyle(LINING_SHADE, 1).fillRoundedRect(x + w * 0.62, y + 3, w * 0.38 - 2, h - 6, 6);
    g.lineStyle(3, OUTLINE, 1).strokeRoundedRect(x, y + 1, w, h - 2, 8);
    g.fillStyle(LINING_NUCLEUS, 1).fillCircle(x + w * 0.4, y + h / 2, Math.min(5, h / 5));
  }
}
