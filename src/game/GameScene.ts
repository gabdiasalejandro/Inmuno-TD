import Phaser from 'phaser';
import { content, levelIntros, levels, tutorials, worlds, type TutorialTarget } from '../data';
import { t } from '../i18n';
import {
  SIM_TICK_MS,
  TICKS_PER_SECOND,
  createSim,
  secondsToTicks,
  type EnemyDef,
  type LevelDef,
  type PlaceFailure,
  type PowerFailure,
  type Sim,
  type SignalSource,
  type SimEvent,
  type UnitDef,
} from '../sim';
import { Hud } from '../ui/Hud';
import { IntroCard } from '../ui/IntroCard';
import { TutorialGuide } from '../ui/TutorialGuide';
import { createFullscreenButton, type FullscreenButton } from '../ui/FullscreenButton';
import { HUD_FULLSCREEN } from '../ui/fullscreenLayout';
import { MARROW_PANEL, cardAt, cardRect, hudLayout, introHit, pauseMenuButtonAt, pointInRect, powerAt, powerRect, resultButtonAt, type Rect } from '../ui/layout';
import { bindCursor } from './cursor';
import { CYTOKINE, banner, floatText, flyParticle, ring, specks } from './effects';
import type { CascadeView } from '../ui/Hud';
import { BOARD_SCALE, createFigure, frontOffset, type Figure } from './figures';
import { createStepper, type Stepper } from './fixedStep';
import { nextLevelId, resultActions } from './flow';
import { boardRight, cellCenter, createBoardLayout, enemyFrontX, isCellFree, pixelToCell, type BoardLayout, type Cell } from './layout';
import { shouldShowIntro } from './intro';
import { canPause, togglePause } from './pause';
import { cytokineEffects, enemiesRemaining, digestFraction, gaugeSignal, isClearLevel, isRecruitBoosted, lostResultKey, scheduledEnemies, shownSignalNames } from './levelView';
import { marrowCharge, marrowExcitement } from './marrow';
import { progressStore } from './progress';
import { preloadSprites } from './sprites';
import { createTutorial, needsNext, shouldRunTutorial, targetsFor, type Tutorial, type TutorialAction } from './tutorial';

/** Longest catch-up per frame: 5 steps = 250 ms of simulated time. */
const MAX_STEPS_PER_FRAME = 5;

const OUTLINE = 0x3a2a2a;
// Board: muted pink tissue with very low contrast between cells (style guide, section 6).
const MATRIX = 0xd2aca7;
const CELL_A = 0xe1c3be;
const CELL_B = 0xdec0bb;
const CELL_NUCLEUS = 0xcfa9a5;
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
/** NET strands: decondensed chromatin, the nucleus colour of the stain, pale. */
const NET_STRAND = 0xa47cc8;
/** Granule proteins caught in a NET: the neutrophil's fine granules. */
const NET_GRANULE = 0xd3b6ce;
/** Specks a spreading bacterium leaves as it slips into the next lane (hyaluronidase dissolving matrix). */
const SPREAD_SPECK = 0xd2aca7;
/** Virus body colour (assets/sprites/virus): infection marks and burst specks. */
const VIRUS = 0x36b862;
/** Interferon's antiviral state: a soft, pale blue shield around a protected cell. */
const SHIELD = 0x9fd3e6;
// Complement: the opsonin purple of the style guide and the membrane-attack PAMP colour.
const OPSONIN = 0x7b4fa3;
const MEMBRANE_ATTACK = 0x8e2c6b;
/** How long the cascade's chips stay lit after its last step. */
const CASCADE_SHOW_MS = 3500;

/** Vertical gap between a cell's bottom edge and the figure's ground point. */
const FOOT_INSET = 8;
const FLASH_MS = 400;
const BARRIER_W = 44;
/** While the release is held, each charged source sends a cytokine particle to the meter this often. */
const FLOW_EVERY_MS = 140;
/** Most sources that send a particle on one flow beat, so a crowded board stays readable. */
const FLOW_SOURCES = 8;
/** Strip right of the board where a wound's breach is drawn. */
const BREACH_HIT_W = BARRIER_W + 16;
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
  /** The complement cascade on screen: its fired steps, shown until `until` (ms). */
  private cascade: { until: number; view: CascadeView } | null = null;
  private cellFlash: (Cell & { until: number }) | null = null;
  private unitViews = new Map<number, Figure>();
  private enemyViews = new Map<number, Figure>();
  private deathCause = new Map<number, 'killed' | 'expired'>();
  private ghost: Figure | null = null;
  private resultShown = false;
  private retry = false;
  /** The meter's one-time explanation was already shown in this play. */
  private phase: 'intro' | 'play' = 'play';
  private introCard: IntroCard | null = null;
  private signalNames: string[] = [];
  /** The level's damaging gauge (inflammation), or null when it has none. */
  private gauge: ReturnType<typeof gaugeSignal> = null;
  private chargeG!: Phaser.GameObjects.Graphics;
  /** Traps on the board (NETs), drawn under the figures. */
  private trapG!: Phaser.GameObjects.Graphics;
  /** Unit statuses: interferon shields and infection marks. */
  private statusG!: Phaser.GameObjects.Graphics;
  /** Enemies released during play (virions of burst cells), for the progress total. */
  private released = 0;
  /** Types of the sim events seen so far in this play, for tutorial steps that wait for one. */
  private seenEvents = new Set<string>();
  /** Drawn lane (fractional while an enemy slides into its new lane after spreading). */
  private enemyRow = new Map<number, number>();
  /** Guided tutorial of this level; null when it has none or the level was already beaten. */
  private tutorial: Tutorial | null = null;
  private guide: TutorialGuide | null = null;
  /** The pointer holding the release button and when the hold began (scene ms); null when not held. */
  private hold: { pointer: number; since: number } | null = null;
  private lastFlowAt = -Infinity;
  /** The pause panel is open: the sim, the clocks and the tweens are frozen. */
  private paused = false;

  constructor() {
    super('game');
  }

  init(data: Partial<GameSceneData>): void {
    this.levelId = data?.levelId ?? '1-1';
    this.retry = data?.retry ?? false;
    // Scene instances are reused on restart: every play explains the meter again.
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
    this.cascade = null;
    this.cellFlash = null;
    this.unitViews = new Map();
    this.enemyViews = new Map();
    this.deathCause = new Map();
    this.ghost = null;
    this.resultShown = false;
    this.released = 0;
    this.signalNames = shownSignalNames(level, content.signals, content.units);
    this.gauge = gaugeSignal(level, content.signals);
    this.seenEvents = new Set();
    this.enemyRow = new Map();
    this.introCard = null;
    this.tutorial = null;
    this.guide = null;
    this.hold = null;
    this.lastFlowAt = -Infinity;
    // The scene's clock and tween manager outlive a restart: never carry a pause into the next play.
    this.paused = false;
    this.time.paused = false;
    this.tweens.resumeAll();

    this.drawBoard();
    this.lanesG = this.add.graphics().setDepth(1);
    this.cursorG = this.add.graphics().setDepth(1.5);
    this.barsG = this.add.graphics().setDepth(4.5);
    this.chargeG = this.add.graphics().setDepth(4.4);
    this.trapG = this.add.graphics().setDepth(1.8);
    this.statusG = this.add.graphics().setDepth(4.3);
    const deck = level.deck.map((id) => this.unitDefs.get(id)).filter((d): d is UnitDef => d !== undefined);
    const powers = (level.powers ?? []).flatMap((id) => content.powers?.find((p) => p.id === id) ?? []);
    this.hud = new Hud(this, deck, { meter: this.signalNames.length > 0, clear: isClearLevel(level), gauge: this.gauge, powers });
    // Above the result overlay and the concept card, so the player can still toggle it there.
    this.fullscreen = createFullscreenButton(this, HUD_FULLSCREEN, { fill: 0xf3e4e0, shade: 0xc9a6a1, depth: 22, iconOnly: true });

    const tutorialDef = tutorials[this.levelId];
    if (shouldRunTutorial(tutorialDef, progressStore().load().completed.includes(this.levelId)) && tutorialDef) {
      this.tutorial = createTutorial(tutorialDef.steps);
      this.guide = new TutorialGuide(this, this.hud);
    }

    // The concept card holds the simulation until the player starts; a retry goes straight to play.
    const intro = levelIntros[this.levelId];
    if (intro && shouldShowIntro(intro, this.retry)) {
      this.phase = 'intro';
      this.introCard = new IntroCard(this, intro);
    } else {
      this.beginPlay();
    }

    bindCursor(this, (p) => this.overClickable(p.worldX, p.worldY));
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.keyboard?.on('keydown-ESC', this.onPauseKey, this);
    this.input.keyboard?.on('keydown-P', this.onPauseKey, this);
    this.events.once('shutdown', () => {
      this.input.keyboard?.off('keydown-ESC', this.onPauseKey, this);
      this.input.keyboard?.off('keydown-P', this.onPauseKey, this);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointerupoutside', this.onPointerUp, this);
      this.fullscreen?.destroy();
      this.fullscreen = null;
      this.guide?.destroy();
      this.guide = null;
    });
  }

  update(_time: number, delta: number): void {
    const state = this.sim.state;
    // Paused: nothing advances and the frame stays as it was; the panel on top is the only thing alive.
    if (this.paused) return;
    this.tutorial?.observe({
      stored: this.storedCharge(),
      signals: this.signalLevels(),
      seen: this.seenEvents,
      enemies: new Set(this.sim.state.enemies.map((enemy) => enemy.defId)),
      statuses: this.carriedStatuses(),
    });
    this.reportHold();
    if (state.status === 'playing' && this.phase === 'play') {
      // A tutorial step can stop the clock or slow it while it waits for the player.
      const { steps, alpha } = this.stepper.advance(delta * (this.tutorial?.timeScale ?? 1));
      this.alpha = alpha;
      for (let i = 0; i < steps && this.sim.state.status === 'playing'; i++) {
        this.prevPos = new Map(state.enemies.map((e) => [e.uid, e.pos]));
        this.handleEvents(this.sim.step());
      }
    }
    if (state.status !== 'playing' && !this.resultShown) {
      this.endHold();
      this.alpha = 1;
      this.resultShown = true;
      this.selected = null;
      const next = nextLevelId(this.levelId, worlds, levels);
      this.hud.showResult(state.status, resultActions(state.status, next), isClearLevel(this.level), lostResultKey(state.defeat));
    }
    this.render(this.time.now);
    this.updateGuide(this.time.now);
  }

  /** Closes the concept card (if any) and starts the clock with the level's banner. */
  private beginPlay(): void {
    this.phase = 'play';
    this.introCard?.destroy();
    this.introCard = null;
    const intro = levelIntros[this.levelId];
    if (!intro) return;
    const { layout } = this;
    banner(this, t(intro.banner), layout.x + (layout.cols * layout.cellW) / 2, layout.y + (layout.rows * layout.cellH) / 2);
  }

  private handleEvents(events: SimEvent[]): void {
    const { layout } = this;
    const died = new Set(events.flatMap((e) => (e.type === 'enemy_died' ? [e.uid] : [])));
    for (const event of events) {
      this.seenEvents.add(event.type);
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
          if (attacker && this.unitDefs.get(attacker.defId)?.attack?.type === 'fagocitosis') {
            // Every bite shows digestion; a swallowed prey keeps the vacuole busy for longer.
            this.unitViews.get(event.uid)?.digest(swallows ? 1400 : 700);
          }
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
        case 'signal_released':
          this.showFlow();
          break;
        case 'unit_died':
          this.deathCause.set(event.uid, event.cause);
          break;
        case 'trap_laid': {
          // The neutrophil casts its net: a burst of strands from its cell.
          const { x, y } = cellCenter(layout, event.row, event.col);
          ring(this, x, y, NET_STRAND, 12, 60, 420);
          break;
        }
        case 'trap_hit':
          this.enemyViews.get(event.target)?.hit();
          break;
        case 'enemy_switched_lane': {
          const view = this.enemyViews.get(event.uid);
          if (view) specks(this, view.root.x, view.root.y - 25, SPREAD_SPECK, 5);
          break;
        }
        case 'enemy_consumed': {
          // The virion slips into the cell it infects instead of dying.
          const view = this.enemyViews.get(event.uid);
          const cell = this.sim.state.units.find((u) => u.uid === event.target);
          if (view && cell) {
            const { x, y } = cellCenter(layout, cell.row, cell.col);
            this.enemyViews.delete(event.uid);
            view.engulfedInto(x, y);
            this.unitViews.get(event.target)?.hit();
          }
          break;
        }
        case 'status_applied':
          if (event.status === 'protegida') {
            const cell = this.sim.state.units.find((u) => u.uid === event.uid);
            if (cell) {
              const { x, y } = cellCenter(layout, cell.row, cell.col);
              ring(this, x, y, SHIELD, 14, 44, 420);
            }
          }
          break;
        case 'status_burst': {
          const { x, y } = cellCenter(layout, event.row, event.col);
          this.released += event.released.length;
          ring(this, x, y, VIRUS, 16, 90, 520);
          specks(this, x, y, VIRUS, 9);
          this.deathCause.set(event.uid, 'killed');
          break;
        }
        case 'cell_attacked': {
          // The NK cell strikes: a quick squeeze of its own and a hit on the infected cell.
          this.unitViews.get(event.uid)?.squeeze();
          this.unitViews.get(event.target)?.hit();
          const cell = this.sim.state.units.find((u) => u.uid === event.target);
          if (cell) {
            const { x, y } = cellCenter(layout, cell.row, cell.col);
            specks(this, x, y - 20, 0xb8324a, 5);
          }
          break;
        }
        case 'power_step':
          this.showPowerStep(event);
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
    if (this.paused) {
      this.onPauseAction(pauseMenuButtonAt(this.hud.pauseButtons, x, y));
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
    if (pointInRect(this.hud.pauseRect, x, y)) {
      this.setPaused(true);
      return;
    }
    if (this.tutorialPointerDown(x, y)) return;
    if (this.overRelease(x, y)) {
      if (!this.tutorialAllows({ type: 'hold', seconds: 0 })) {
        this.blockedByTutorial();
        return;
      }
      this.startHold(p.id);
      return;
    }
    const cardIndex = cardAt(x, y, this.hud.cardCount, this.hud.powerCount);
    if (cardIndex !== null) {
      const id = this.hud.cardId(cardIndex) ?? null;
      if (id !== null && !this.tutorialAllows({ type: 'select', unit: id })) {
        this.blockedByTutorial();
        return;
      }
      this.selected = this.selected === id ? null : id;
      return;
    }
    const powerIndex = powerAt(x, y, this.hud.powerCount);
    if (powerIndex !== null) {
      const id = this.hud.powerId(powerIndex) ?? null;
      this.selected = this.selected === id ? null : id;
      return;
    }
    const cell = pixelToCell(this.layout, x, y);
    this.hover = cell;
    if (cell && this.selected) {
      const action: TutorialAction = this.isPower(this.selected)
        ? { type: 'power', power: this.selected, row: cell.row, col: cell.col }
        : { type: 'place', unit: this.selected, row: cell.row, col: cell.col };
      if (!this.tutorialAllows(action)) {
        this.blockedByTutorial();
        return;
      }
      this.tryPlace(this.selected, cell);
    }
  }

  // ---- pause ----

  private onPauseKey(): void {
    this.setPaused(togglePause(this.paused, canPause(this.phase, this.sim.state.status)));
  }

  private onPauseAction(action: ReturnType<typeof pauseMenuButtonAt>): void {
    if (action === 'resume') this.setPaused(false);
    else if (action === 'restart') this.scene.restart({ levelId: this.levelId, retry: true });
    else if (action === 'menu') this.scene.start('menu');
  }

  /**
   * Freezes everything that advances the play (the sim loop, the clock, every tween) and opens the
   * pause panel, or undoes it. The tutorial, the selection and the sim keep their state untouched.
   */
  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    if (paused && !canPause(this.phase, this.sim.state.status)) return;
    this.paused = paused;
    if (paused) {
      this.endHold();
      this.hover = null;
      this.guide?.update(null, this.time.now);
      this.hud.showPause();
      this.tweens.pauseAll();
      this.time.paused = true;
      return;
    }
    this.time.paused = false;
    this.tweens.resumeAll();
    this.hud.hidePause();
    const pointer = this.input.activePointer;
    if (!pointer.wasTouch) this.hover = pixelToCell(this.layout, pointer.worldX, pointer.worldY);
  }

  // ---- tutorial ----

  /** Whether the tutorial lets the player do this right now (always, without a tutorial). */
  private tutorialAllows(action: TutorialAction): boolean {
    return this.tutorial?.allows(action) ?? true;
  }

  private blockedByTutorial(): void {
    this.hud.showToast(t('tutorial.blocked'), this.time.now);
  }

  /** Handles the clicks that belong to the tutorial itself; true when it swallowed this one. */
  private tutorialPointerDown(x: number, y: number): boolean {
    const tutorial = this.tutorial;
    if (!tutorial || tutorial.finished || !tutorial.active) return false;
    if (this.guide?.overNext(x, y)) {
      tutorial.perform({ type: 'tap' });
      return true;
    }
    return false;
  }

  /** Level (0 to 1) of every signal active in this level, for tutorial steps that wait for one. */
  /** Statuses some unit on the board carries right now. */
  private carriedStatuses(): Set<string> {
    const { tick, units } = this.sim.state;
    return new Set(units.flatMap((unit) => Object.keys(unit.statuses).filter((name) => (unit.statuses[name] ?? 0) > tick)));
  }

  private signalLevels(): Record<string, number> {
    return Object.fromEntries(Object.keys(this.sim.state.signals).map((name) => [name, this.sim.signal(name)]));
  }

  /** Charge stored in every source of the signals this level shows, in signal points. */
  private storedCharge(): number {
    return this.signalNames.reduce((sum, name) => sum + this.sim.stored(name), 0);
  }

  private signalSources(): SignalSource[] {
    return [
      ...this.sim.state.units.map((u): SignalSource => ({ kind: 'unit', uid: u.uid })),
      ...this.sim.state.openLanes.map((lane): SignalSource => ({ kind: 'wound', lane })),
    ];
  }

  private cellRect(row: number, col: number): Rect {
    const { x, y } = cellCenter(this.layout, row, col);
    return { x: x - this.layout.cellW / 2, y: y - this.layout.cellH / 2, w: this.layout.cellW, h: this.layout.cellH };
  }

  /** Screen rectangle a tutorial target stands for right now, or null when it is not there. */
  private targetRect(target: TutorialTarget): Rect | null {
    const { layout } = this;
    switch (target.type) {
      case 'card': {
        const index = this.level.deck.indexOf(target.unit);
        return index < 0 ? null : cardRect(index, this.level.deck.length);
      }
      case 'cell':
        return this.cellRect(target.row, target.col);
      case 'power':
        return this.isPower(target.power) ? powerRect() : null;
      case 'unit': {
        const unit = this.sim.state.units.find((u) => u.defId === target.unit);
        return unit ? this.cellRect(unit.row, unit.col) : null;
      }
      case 'marrow':
        return MARROW_PANEL;
      case 'meter':
        return hudLayout(this.hud.cardCount, this.signalNames.length > 0, this.hud.powerCount).meter;
      case 'release_button':
        return this.hud.releaseRect;
      case 'gauge':
        return this.hud.gaugeRect;
      case 'enemy': {
        const enemies = this.sim.state.enemies.filter((e) => e.defId === target.enemy);
        if (enemies.length === 0) return null;
        const front = enemies.reduce((a, b) => (b.pos < a.pos ? b : a));
        const x = enemyFrontX(layout, front.pos);
        return { x: x - 10, y: layout.y + (this.enemyRow.get(front.uid) ?? front.lane) * layout.cellH, w: layout.cellW, h: layout.cellH };
      }
      case 'status': {
        const { tick } = this.sim.state;
        const unit = this.sim.state.units.find((u) => (u.statuses[target.status] ?? 0) > tick);
        return unit ? this.cellRect(unit.row, unit.col) : null;
      }
      case 'charged_source': {
        const source = this.signalSources().find((s) => (target.kind === undefined || s.kind === target.kind) && (this.sim.charge(s) ?? 0) > 0);
        if (!source) return null;
        if (source.kind === 'wound') return { x: boardRight(layout), y: layout.y + source.lane * layout.cellH, w: BREACH_HIT_W, h: layout.cellH };
        const unit = this.sim.state.units.find((u) => u.uid === source.uid);
        return unit ? this.cellRect(unit.row, unit.col) : null;
      }
    }
  }

  private updateGuide(now: number): void {
    const { tutorial, guide } = this;
    if (!tutorial || !guide) return;
    const step = tutorial.step;
    if (!step || !tutorial.active || this.phase !== 'play' || this.sim.state.status !== 'playing') {
      guide.update(null, now);
      return;
    }
    const targets = targetsFor(step).flatMap((target) => this.targetRect(target) ?? []);
    guide.update({ text: t(step.text), targets, next: needsNext(step) }, now);
  }

  // ---- release button ----

  private overRelease(x: number, y: number): boolean {
    const rect = this.hud.releaseRect;
    return rect !== null && pointInRect(rect, x, y);
  }

  /** The player pressed the release button: stored charge flows into the meter until let go. */
  private startHold(pointer: number): void {
    this.hold = { pointer, since: this.time.now };
    this.sim.setReleasing(true);
  }

  private endHold(): void {
    if (!this.hold) return;
    this.hold = null;
    this.sim.setReleasing(false);
  }

  /** Tells the tutorial how long the button has been held, every frame it is. */
  private reportHold(): void {
    if (!this.hold) return;
    this.tutorial?.perform({ type: 'hold', seconds: (this.time.now - this.hold.since) / 1000 });
  }

  /**
   * Charge is flowing: every few beats each source still holding some sends a particle to the
   * meter, so the player sees where the cytokines come from.
   */
  private showFlow(): void {
    const now = this.time.now;
    const target = this.hud.meterTarget;
    if (!target || now - this.lastFlowAt < FLOW_EVERY_MS) return;
    this.lastFlowAt = now;
    const holding = this.signalSources().filter((source) => (this.sim.charge(source) ?? 0) > 0);
    for (const source of holding.slice(0, FLOW_SOURCES)) {
      const at = this.sourcePoint(source);
      if (at) flyParticle(this, at, target, CYTOKINE, () => this.hud.bumpMeter(this.time.now));
    }
  }

  /** Where a source's charge is drawn: above a unit, or on a lane's breach. */
  private sourcePoint(source: SignalSource): { x: number; y: number } | null {
    const { layout } = this;
    if (source.kind === 'wound') return { x: boardRight(layout) + 4 + BARRIER_W / 2, y: cellCenter(layout, source.lane, 0).y };
    const unit = this.sim.state.units.find((u) => u.uid === source.uid);
    if (!unit) return null;
    const { x, y } = cellCenter(layout, unit.row, unit.col);
    return { x: x + 30, y: y - layout.cellH * 0.32 };
  }

  /** Mirrors `onPointerDown`: true when a click at this point would do something. */
  private overClickable(x: number, y: number): boolean {
    if (this.fullscreen?.hit(x, y)) return true;
    if (this.paused) return pauseMenuButtonAt(this.hud.pauseButtons, x, y) !== null;
    if (this.phase === 'intro') return introHit(x, y) === 'start';
    if (this.sim.state.status !== 'playing') return resultButtonAt(this.hud.resultButtons, x, y) !== null;
    if (this.hud.overHint(x, y)) return true;
    if (pointInRect(this.hud.pauseRect, x, y)) return true;
    if (this.overTutorial(x, y)) return true;
    const cardIndex = cardAt(x, y, this.hud.cardCount, this.hud.powerCount);
    if (cardIndex !== null) return this.tutorialAllows({ type: 'select', unit: this.hud.cardId(cardIndex) ?? '' });
    if (this.overRelease(x, y)) return this.tutorialAllows({ type: 'hold', seconds: 0 });
    const cell = this.selected === null ? null : pixelToCell(this.layout, x, y);
    if (cell === null || this.selected === null) return false;
    const action: TutorialAction = this.isPower(this.selected)
      ? { type: 'power', power: this.selected, row: cell.row, col: cell.col }
      : { type: 'place', unit: this.selected, row: cell.row, col: cell.col };
    return this.tutorialAllows(action);
  }

  /** Mirrors `tutorialPointerDown`: the "Siguiente" button of a tap-to-continue step. */
  private overTutorial(x: number, y: number): boolean {
    const tutorial = this.tutorial;
    if (!tutorial || tutorial.finished || !tutorial.active) return false;
    return this.guide?.overNext(x, y) ?? false;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (this.paused) return;
    this.hover = pixelToCell(this.layout, p.worldX, p.worldY);
    // Sliding off the button lets go of it, as with any held button.
    if (this.hold?.pointer === p.id && !this.overRelease(p.worldX, p.worldY)) this.endHold();
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    // A finger leaves no hover; a mouse keeps it.
    if (p.wasTouch) this.hover = null;
    if (this.hold?.pointer === p.id) this.endHold();
  }

  private tryPlace(defId: string, cell: Cell): void {
    if (this.isPower(defId)) {
      this.tryPower(defId, cell);
      return;
    }
    const result = this.sim.placeUnit(defId, cell.row, cell.col);
    if (result.ok) {
      this.selected = null;
      this.tutorial?.perform({ type: 'place', unit: defId, row: cell.row, col: cell.col });
      return;
    }
    this.giveFeedback(result.reason, defId, cell);
  }

  /** Plays a one-use power on the cell; its cascade is shown step by step as its events arrive. */
  private tryPower(defId: string, cell: Cell): void {
    const result = this.sim.playPower(defId, cell.row, cell.col);
    if (result.ok) {
      this.selected = null;
      this.tutorial?.perform({ type: 'power', power: defId, row: cell.row, col: cell.col });
      return;
    }
    this.giveFeedback(result.reason, defId, cell);
  }

  private giveFeedback(reason: PlaceFailure | PowerFailure, defId: string, cell: Cell): void {
    const now = this.time.now;
    if (reason === 'insufficient_energy' || reason === 'on_cooldown') {
      this.cardShake = { defId, until: now + FLASH_MS };
    } else {
      this.cellFlash = { ...cell, until: now + FLASH_MS };
    }
    this.hud.showToast(t(`feedback.${reason}`), now);
  }

  /** Whether this id is one of the level's powers (played on a cell, outside the deck). */
  private isPower(id: string): boolean {
    return this.level.powers?.includes(id) ?? false;
  }

  /** Whether `defId` could be placed on `cell` right now (for the preview only; the sim decides). */
  private canPlace(defId: string, cell: Cell): boolean {
    const { state } = this.sim;
    if (this.isPower(defId)) return state.tick >= (state.powerReadyAt[defId] ?? 0);
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
  }

  private render(now: number): void {
    const { state } = this.sim;
    const { layout } = this;
    this.drawLanes(now);
    this.drawCursor(now);
    this.drawCharges(now);
    this.drawTraps(now);
    this.drawStatuses(now);
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
      // Detection: the receptors glow (the cytokine charge is drawn by `drawCharges`).
      // Digestion: a bite leaves the phagocyte full for a while.
      view.setAlarm(unit.alarmed, now);
      if (def.attack?.type === 'fagocitosis') view.setDigest(digestFraction(unit.attackReadyAt, state.tick, def.attack.rate), now);
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
      // An enemy that spreads to another lane slides across instead of jumping.
      const shownRow = this.enemyRow.get(enemy.uid) ?? enemy.lane;
      const row = Math.abs(enemy.lane - shownRow) < 0.02 ? enemy.lane : shownRow + (enemy.lane - shownRow) * 0.18;
      this.enemyRow.set(enemy.uid, row);
      const y = layout.y + (row + 0.5) * layout.cellH;
      const foot = y + layout.cellH / 2 - FOOT_INSET;
      const x = enemyFrontX(layout, pos) + frontOffset(enemy.defId) * BOARD_SCALE;
      let view = this.enemyViews.get(enemy.uid);
      if (!view) {
        view = createFigure(this, enemy.defId, x, foot).setDepth(2.05 + enemy.lane * 0.1).idle().pop();
        this.enemyViews.set(enemy.uid, view);
      }
      view.setPosition(x, foot).setMoving(enemy.pos !== prev || row !== enemy.lane);
      view.setDepth(2.05 + row * 0.1);
      const def = this.enemyDefs.get(enemy.defId);
      if (def && enemy.hp < def.hp) this.drawBar(bars, x - 30, foot - 70, 60, 6, enemy.hp / def.hp, BAR_LOW);
      // Opsonized: a pulsing purple ring tells the player phagocytes can now see this enemy.
      if ((enemy.statuses?.opsonizado ?? 0) > state.tick) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 110 + enemy.uid);
        bars.lineStyle(5, OPSONIN, 0.55 + 0.35 * pulse).strokeCircle(x, foot - 44, 32 + 4 * pulse);
      }
    }
    for (const [uid, view] of this.enemyViews) {
      if (liveEnemies.has(uid)) continue;
      specks(this, view.root.x, view.root.y - 25, 0x7452e0, 6);
      view.die('killed');
      this.enemyViews.delete(uid);
      this.enemyRow.delete(uid);
    }

    const total = this.level.win?.type === 'survive' ? this.level.win.seconds : null;
    const cytokines = this.signalNames.length > 0 ? this.sim.signal(this.signalNames[0] as string) : null;
    this.hud.update({
      now,
      tick: state.tick,
      energy: state.energy,
      deployReadyAt: state.deployReadyAt,
      selected: this.selected,
      remainingSeconds: total === null ? null : Math.max(0, total - state.tick / TICKS_PER_SECOND),
      totalSeconds: total,
      remainingEnemies: isClearLevel(this.level) ? enemiesRemaining(this.level, state.nextSpawn, state.enemies.length) : null,
      totalEnemies: scheduledEnemies(this.level) + this.released,
      charge: marrowCharge(this.sim.marrowFraction()),
      excite: marrowExcitement(cytokines ?? 0),
      cytokines,
      effects: cytokines === null ? null : cytokineEffects(content.signals, this.signalNames, this.sim.signal),
      boosted: new Set(
        [...this.unitDefs.values()].filter((d) => isRecruitBoosted(d, content.signals, this.signalNames, this.sim.signal)).map((d) => d.id),
      ),
      release:
        cytokines === null
          ? null
          : { stored: this.storedCharge(), max: content.signals?.[this.signalNames[0] as string]?.max ?? 100, held: this.hold !== null },
      inflammation: this.gauge ? this.sim.signal(this.gauge.name) : null,
      shake: this.cardShake,
      powerReadyAt: state.powerReadyAt,
      cascade: this.cascade && now < this.cascade.until ? this.cascade.view : null,
    });
  }

  /**
   * One step of the complement cascade: its name floats over the board, marked enemies get a ring
   * (opsonins and the membrane attack), and the recruit appears by itself as a unit.
   */
  private showPowerStep(event: Extract<SimEvent, { type: 'power_step' }>): void {
    const { layout } = this;
    const now = this.time.now;
    const running = this.cascade && now < this.cascade.until && this.cascade.view.power === event.power ? this.cascade.view.kinds : [];
    this.cascade = { until: now + CASCADE_SHOW_MS, view: { power: event.power, kinds: [...running, event.kind], current: event.kind } };
    const labelColor = event.kind === 'attack' ? '#8E2C6B' : '#7B4FA3';
    const line = t(`power.step.${event.kind}.short`);
    floatText(this, layout.x + (layout.cols * layout.cellW) / 2, layout.y + (layout.rows * layout.cellH) / 2, line, labelColor, 28, 32);
    for (const uid of event.enemies) {
      const view = this.enemyViews.get(uid);
      if (!view) continue;
      if (event.kind === 'attack') {
        ring(this, view.root.x, view.root.y - 40, MEMBRANE_ATTACK, 16, 96, 480);
        specks(this, view.root.x, view.root.y - 40, MEMBRANE_ATTACK, 8);
      } else if (event.kind === 'opsonize') {
        ring(this, view.root.x, view.root.y - 44, OPSONIN, 22, 72, 560);
      }
    }
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

  /**
   * Cytokine charge of every source in play: a small teal dial that fills toward the source's
   * capacity, so the player sees which cells hold charge for the release button.
   */
  private drawCharges(now: number): void {
    const g = this.chargeG.clear();
    if (this.sim.state.status !== 'playing') return;
    for (const source of this.signalSources()) {
      const charge = this.sim.charge(source);
      if (charge === null || charge <= 0) continue;
      const at = this.sourcePoint(source);
      if (!at) continue;
      const r = 10;
      if (charge >= 1) {
        // Full: a faint halo while the player releases, so the flowing sources stand out.
        if (this.hold) g.fillStyle(CYTOKINE, 0.2 + 0.15 * Math.sin(now / 120)).fillCircle(at.x, at.y, r + 6);
        g.fillStyle(CYTOKINE, 1).fillCircle(at.x, at.y, r);
        g.fillStyle(0xe8fbf8, 1).fillCircle(at.x - 3, at.y - 3, 2.5);
        g.lineStyle(3, OUTLINE, 1).strokeCircle(at.x, at.y, r);
        continue;
      }
      g.fillStyle(0xfbf7f2, 0.85).fillCircle(at.x, at.y, r);
      g.fillStyle(CYTOKINE, 0.9).slice(at.x, at.y, r, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2, false).fillPath();
      g.lineStyle(3, OUTLINE, 0.9).strokeCircle(at.x, at.y, r);
    }
  }

  /**
   * NETs: a web of chromatin strands over the cell, with granules caught in it. It fades out over
   * its last second.
   */
  private drawTraps(now: number): void {
    const g = this.trapG.clear();
    const { layout } = this;
    const { tick } = this.sim.state;
    for (const trap of this.sim.state.traps) {
      const left = (trap.until - tick) / TICKS_PER_SECOND;
      const alpha = Math.min(1, left) * Math.min(1, (tick - trap.laidAt) / 4 + 0.3);
      const { x, y } = cellCenter(layout, trap.row, trap.col);
      const r = Math.min(layout.cellW, layout.cellH) * 0.44;
      const sway = Math.sin(now / 260 + trap.uid) * 0.06;
      const spokes = 7;
      const ends: Array<[number, number]> = [];
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2 + sway + noise(trap.uid, i, 1) * 0.4;
        const k = 0.8 + 0.2 * noise(trap.uid, i, 2);
        ends.push([x + Math.cos(a) * r * k, y + Math.sin(a) * r * k * 0.85]);
      }
      g.lineStyle(4, OUTLINE, 0.55 * alpha);
      for (const [ex, ey] of ends) g.lineBetween(x, y, ex, ey);
      g.lineStyle(2.5, NET_STRAND, 0.95 * alpha);
      for (const [ex, ey] of ends) g.lineBetween(x, y, ex, ey);
      // Two loose rings of strands joining the spokes.
      for (const ring of [0.45, 0.8]) {
        for (let i = 0; i < spokes; i++) {
          const [ax, ay] = ends[i] as [number, number];
          const [bx, by] = ends[(i + 1) % spokes] as [number, number];
          g.lineBetween(x + (ax - x) * ring, y + (ay - y) * ring, x + (bx - x) * ring, y + (by - y) * ring);
        }
      }
      // Granule proteins caught in the web.
      g.fillStyle(NET_GRANULE, 0.9 * alpha);
      for (let i = 0; i < 5; i++) {
        const [ex, ey] = ends[i] as [number, number];
        const k = 0.3 + 0.5 * noise(trap.uid, i, 3);
        g.fillCircle(x + (ex - x) * k, y + (ey - y) * k, 3);
      }
    }
  }

  /**
   * Unit statuses: a pale shield bubble around cells protected by interferon, and on infected cells
   * a pulsing green ring with an arc that empties as the burst approaches.
   */
  private drawStatuses(now: number): void {
    const g = this.statusG.clear();
    const { layout } = this;
    const { tick } = this.sim.state;
    const burstTicks = secondsToTicks(content.statuses?.infectada?.duration ?? 1);
    for (const unit of this.sim.state.units) {
      const { x, y } = cellCenter(layout, unit.row, unit.col);
      const r = Math.min(layout.cellW, layout.cellH) * 0.46;
      const shieldUntil = unit.statuses.protegida ?? 0;
      if (shieldUntil > tick) {
        const fade = Math.min(1, (shieldUntil - tick) / TICKS_PER_SECOND);
        const pulse = 0.5 + 0.5 * Math.sin(now / 300 + unit.uid);
        g.fillStyle(SHIELD, (0.16 + 0.06 * pulse) * fade).fillCircle(x, y, r);
        g.lineStyle(3, SHIELD, 0.85 * fade).strokeCircle(x, y, r);
      }
      const infectedUntil = unit.statuses.infectada ?? 0;
      if (infectedUntil > tick) {
        const left = Math.max(0, Math.min(1, (infectedUntil - tick) / burstTicks));
        const beat = 0.5 + 0.5 * Math.sin(now / (60 + 140 * left));
        g.lineStyle(5, VIRUS, 0.5 + 0.4 * beat).strokeCircle(x, y, r * (0.92 + 0.06 * beat));
        g.lineStyle(6, OUTLINE, 0.8).beginPath();
        g.arc(x, y - r - 10, 9, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2, false).strokePath();
        g.lineStyle(4, VIRUS, 1).beginPath();
        g.arc(x, y - r - 10, 9, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2, false).strokePath();
      }
    }
  }

  /** Area a selected power would reach around the hovered cell; faint while the power recharges. */
  private drawPowerArea(g: Phaser.GameObjects.Graphics, id: string, hover: Cell, now: number): void {
    const radius = content.powers?.find((p) => p.id === id)?.radius ?? 0;
    const ready = this.sim.state.tick >= (this.sim.state.powerReadyAt[id] ?? 0);
    const alpha = ready ? 0.16 + 0.08 * (0.5 + 0.5 * Math.sin(now / 160)) : 0.05;
    const { layout } = this;
    for (let row = Math.max(0, hover.row - radius); row <= Math.min(layout.rows - 1, hover.row + radius); row++) {
      for (let col = Math.max(0, hover.col - radius); col <= Math.min(layout.cols - 1, hover.col + radius); col++) {
        const { x, y } = cellCenter(layout, row, col);
        g.fillStyle(0x7b4fa3, alpha).fillRoundedRect(x - layout.cellW / 2 + 4, y - layout.cellH / 2 + 4, layout.cellW - 8, layout.cellH - 8, 20);
      }
    }
  }

  /** Target cell while a card is selected: a ghost of the unit if it fits, a refusal mark if not. */
  private drawCursor(now: number): void {
    const g = this.cursorG.clear();
    const { layout } = this;
    const powerSelected = this.selected !== null && this.isPower(this.selected);
    if (powerSelected && this.hover && this.sim.state.status === 'playing') this.drawPowerArea(g, this.selected!, this.hover, now);
    const showGhost = this.selected !== null && this.hover !== null && this.sim.state.status === 'playing' && !powerSelected;
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
