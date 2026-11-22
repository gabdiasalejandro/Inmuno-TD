import Phaser from 'phaser';
import { bindCursor } from './cursor';
import { levels, worlds } from '../data';
import { t } from '../i18n';
import {
  ALMANAC_BUTTON,
  BACK_BUTTON,
  CAPTION_POS,
  DIFFICULTY_BUTTON,
  LEVEL_COUNT_MAX,
  LEVEL_NODE_SIZE,
  NEXT_LEVEL_BUTTON,
  TITLE_POS,
  WORLD_SIZE,
  almanacHit,
  backHit,
  difficultyAt,
  levelAt,
  levelLabelSide,
  levelPos,
  nextLevelHit,
  routePoints,
  worldAt,
  worldLabelSide,
  worldPos,
  type LabelSide,
  type Point,
} from '../ui/menuLayout';
import { createFullscreenButton, type FullscreenButton } from '../ui/FullscreenButton';
import { CANVAS_FULLSCREEN } from '../ui/fullscreenLayout';
import { buildMenu, nextPlayableLevel, type MenuLevelState, type MenuWorld } from '../ui/menuModel';
import { BACKDROP_SIZE, BACK_KEY, DOT_KEY, NODE_KEYS, WORLD_TINTS, backdropKey, loadMenuSprites, loadWorldBackdrop, worldKey } from './menuSprites';
import { progressStore } from './progress';
import { difficultyStore } from './difficulty';
import { backgroundLoadSprites } from './sprites';
import { DIFFICULTIES, type Difficulty } from '../data';

const FONT = 'sans-serif';
const INK = '#3A2A2A';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xfbf7f2;
const PLATE = 0xeed3cd;
const VESSEL = 0xf3dcd6;
const TRAVELLED = 0x8fae58;
const FOLD = 0xd6b3ad;
const LABEL_BG = '#F4E6E1';
const ROUTE_SAMPLES = 14;
const SHAKE_MS = 70;
const FOCUS_SCALE = 1.12;
const ACCENT = 0x7b4fa3;
/** Sepsis half of the difficulty selector when chosen: a deep inflamed red. */
const SEPSIS = 0xa8323e;
/** Red wash over the menu while Sepsis is chosen. */
const SEPSIS_WASH = 0xc0404c;
/** Saturated pathogen bodies of the Sepsis menu bacteria. */
const BACTERIUM = 0xd9644f;
const BACTERIUM_DARK = 0x8e2c6b;
const INK_LIGHT = '#FBF7F2';

type Target =
  | { kind: 'world' | 'level'; index: number }
  | { kind: 'back' }
  | { kind: 'almanac' }
  | { kind: 'fullscreen' }
  | { kind: 'next' }
  | { kind: 'difficulty'; value: Difficulty }
  | null;
type View = { kind: 'map' } | { kind: 'world'; index: number };

/** The world the player last opened, so coming back from a level reopens its level path. */
let lastWorld: number | null = null;

/**
 * Provisional worlds-and-levels menu: a map of the eight worlds joined by one route, and a level path
 * per world. Plain pointer hit-testing on logical 1280x720 coordinates (geometry in `menuLayout`).
 */
export class MenuScene extends Phaser.Scene {
  private menu: MenuWorld[] = [];
  private view: View = { kind: 'map' };
  /** World ringed on the map: the last one opened, or the first. */
  private selected = 0;
  private hovered: number | null = null;
  private pressed: Target = null;
  private fullscreen: FullscreenButton | null = null;
  /** Level started by the "next level" shortcut, or null when everything built is done. */
  private nextLevel: string | null = null;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private tweensOfView: Phaser.Tweens.Tween[] = [];
  /** One container per world on the map, or per level on a level path. */
  private nodes: Phaser.GameObjects.Container[] = [];
  /** The player just picked Sepsis: the next render fades its mood in. */
  private sepsisEntering = false;

  constructor() {
    super('menu');
  }

  preload(): void {
    loadMenuSprites(this);
  }

  create(): void {
    // Progress is re-read on every visit so returning from a won level shows it.
    this.menu = buildMenu(worlds, new Set(Object.keys(levels)), progressStore().load().completed);
    this.nextLevel = nextPlayableLevel(this.menu);
    this.view = lastWorld !== null && this.menu[lastWorld] && !this.menu[lastWorld]!.comingSoon ? { kind: 'world', index: lastWorld } : { kind: 'map' };
    this.selected = Math.min(lastWorld ?? this.selected, this.menu.length - 1);
    this.pressed = null;
    this.hovered = null;

    this.drawFolds();

    bindCursor(this, (p) => this.target(p.x, p.y) !== null);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.fullscreen?.destroy();
      this.fullscreen = null;
    });

    this.render(false);
    backgroundLoadSprites(this);
  }

  // ---- drawing helpers -------------------------------------------------------------------------

  private text(x: number, y: number, value: string, size: number, bold: boolean, color = INK): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });
  }

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.dynamic.push(object);
    return object;
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const tween = this.tweens.add(config);
    this.tweensOfView.push(tween);
    return tween;
  }

  /** Static tissue folds behind everything, so the flat background has some depth. */
  private drawFolds(): void {
    const g = this.add.graphics();
    g.fillStyle(FOLD, 1);
    g.fillEllipse(180, 660, 520, 150);
    g.fillEllipse(1120, 90, 560, 140);
    g.fillEllipse(700, 700, 380, 90);
    g.fillEllipse(40, 120, 220, 200);
    g.fillEllipse(1250, 620, 260, 220);
    g.setDepth(-10);
  }

  private clear(): void {
    this.fullscreen?.destroy();
    this.fullscreen = null;
    for (const tween of this.tweensOfView) tween.remove();
    this.tweensOfView = [];
    for (const object of this.dynamic) object.destroy();
    this.dynamic = [];
    this.nodes = [];
  }

  private render(animate: boolean): void {
    this.clear();
    if (this.view.kind === 'map') this.renderMap();
    else this.renderWorld(this.view.index);
    this.drawDifficulty();
    if (difficultyStore().load() === 'sepsis') this.drawSepsis(this.sepsisEntering);
    this.sepsisEntering = false;
    this.drawDrifters();
    this.fullscreen = createFullscreenButton(this, CANVAS_FULLSCREEN);
    if (animate) this.cameras.main.fadeIn(180, 0xdd, 0xbd, 0xb8);
  }

  /** Difficulty selector, bottom right on every view: the chosen half is filled. */
  private drawDifficulty(): void {
    const r = DIFFICULTY_BUTTON;
    const chosen = difficultyStore().load();
    const half = r.w / DIFFICULTIES.length;
    const g = this.keep(this.add.graphics().setDepth(2));
    g.fillStyle(PANEL, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 14);
    DIFFICULTIES.forEach((difficulty, i) => {
      const x = r.x + i * half;
      const on = difficulty === chosen;
      if (on) {
        g.fillStyle(difficulty === 'sepsis' ? SEPSIS : ACCENT, 1);
        g.fillRoundedRect(x + 5, r.y + 5, half - 10, r.h - 10, 10);
      }
      this.keep(this.text(x + half / 2, r.y + r.h / 2, t(`difficulty.${difficulty}`), 20, true, on ? INK_LIGHT : INK).setOrigin(0.5).setDepth(2.1));
    });
    g.lineStyle(4, OUTLINE, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 14);
    g.lineBetween(r.x + half, r.y + 8, r.x + half, r.y + r.h - 8);
  }

  /**
   * Sepsis mood behind the menu: the tissue turns redder and small, simple bacteria drift around.
   * `entering` fades it in, for the moment the player picks Sepsis.
   */
  private drawSepsis(entering: boolean): void {
    const wash = this.keep(this.add.rectangle(640, 360, 1280, 720, SEPSIS_WASH, 0.22).setDepth(-9));
    if (entering) this.tween({ targets: wash, alpha: { from: 0, to: 1 }, duration: 600 });
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(40, 1240);
      const y = Phaser.Math.Between(130, 700);
      const g = this.keep(this.add.graphics({ x, y }).setDepth(-4.5));
      g.fillStyle(i % 3 === 0 ? BACTERIUM_DARK : BACTERIUM, 1);
      g.lineStyle(3, OUTLINE, 0.8);
      if (i % 2 === 0) {
        // Coccus: a small round cell.
        g.fillCircle(0, 0, 9);
        g.strokeCircle(0, 0, 9);
      } else {
        // Bacillus: a short rod.
        g.fillRoundedRect(-14, -7, 28, 14, 7);
        g.strokeRoundedRect(-14, -7, 28, 14, 7);
      }
      g.setRotation(Phaser.Math.FloatBetween(0, Math.PI)).setAlpha(0.7);
      if (entering) this.tween({ targets: g, scale: { from: 0, to: 1 }, duration: 350, delay: i * 40, ease: 'Back.easeOut' });
      this.tween({
        targets: g,
        x: x + Phaser.Math.Between(-60, 60),
        y: y + Phaser.Math.Between(-40, 40),
        rotation: g.rotation + Phaser.Math.FloatBetween(-1, 1),
        duration: Phaser.Math.Between(5000, 9000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** A few pale specks that drift slowly. Cheap: a dozen sprites, one yoyo tween each. */
  private drawDrifters(): void {
    for (let i = 0; i < 12; i++) {
      const x = Phaser.Math.Between(40, 1240);
      const y = Phaser.Math.Between(120, 690);
      const size = Phaser.Math.Between(10, 22);
      const bit = this.keep(this.add.image(x, y, DOT_KEY).setDisplaySize(size, size).setTint(0xf3e1dc).setAlpha(0.55).setDepth(-5));
      this.tween({
        targets: bit,
        x: x + Phaser.Math.Between(-70, 70),
        y: y - Phaser.Math.Between(20, 60),
        duration: Phaser.Math.Between(4500, 8000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Glowing motes that rise through a world's backdrop and fade out. */
  private drawMotes(color: number): void {
    for (let i = 0; i < 16; i++) {
      const x = Phaser.Math.Between(60, 1220);
      const size = Phaser.Math.Between(8, 18);
      const mote = this.keep(this.add.image(x, 680, DOT_KEY).setDisplaySize(size, size).setTint(color).setAlpha(0).setDepth(-4));
      this.tween({
        targets: mote,
        y: 140,
        x: x + Phaser.Math.Between(-60, 60),
        alpha: { from: 0.85, to: 0 },
        duration: Phaser.Math.Between(6000, 11000),
        delay: Phaser.Math.Between(0, 8000),
        repeat: -1,
      });
    }
  }

  /** Thick outlined ribbon along the sampled route, up to sample `to`. */
  private drawRibbon(g: Phaser.GameObjects.Graphics, route: Point[], outer: number, inner: number, fill: number, to = route.length - 1): void {
    for (const [width, color] of [[outer, OUTLINE], [inner, fill]] as const) {
      g.lineStyle(width, color, 1);
      g.beginPath();
      g.moveTo(route[0]!.x, route[0]!.y);
      for (let i = 1; i <= to; i++) g.lineTo(route[i]!.x, route[i]!.y);
      g.strokePath();
    }
  }

  // ---- world map ---------------------------------------------------------------------------------

  private renderMap(): void {
    this.keep(this.text(TITLE_POS.x, TITLE_POS.y, t('menu.title'), 52, true).setOrigin(0.5, 0));
    this.keep(this.text(CAPTION_POS.x, CAPTION_POS.y, t('menu.worlds'), 22, false).setOrigin(0.5, 0).setAlpha(0.8));

    const route = routePoints(
      this.menu.map((_, i) => worldPos(i)),
      ROUTE_SAMPLES,
    );
    const g = this.keep(this.add.graphics());
    this.drawRibbon(g, route, 26, 14, VESSEL);
    this.drawFlow(route);

    this.menu.forEach((world, i) => this.nodes.push(this.drawWorld(world, i)));
    this.drawAlmanacButton();
    if (this.nextLevel !== null) this.drawNextLevelButton();
    this.applyFocus();
  }

  /** Button to the almanac, top right of the world map: a small book and its name. */
  private drawAlmanacButton(): void {
    const r = ALMANAC_BUTTON;
    const g = this.keep(this.add.graphics());
    g.fillStyle(PANEL, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    g.lineStyle(5, OUTLINE, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 18);
    // Book: two covers meeting at a spine, with a few lines of text.
    const bx = r.x + 22;
    const by = r.y + r.h / 2;
    g.fillStyle(0xc4565a, 1);
    g.fillRoundedRect(bx, by - 22, 46, 44, 6);
    g.lineStyle(4, OUTLINE, 1);
    g.strokeRoundedRect(bx, by - 22, 46, 44, 6);
    g.fillStyle(PANEL, 1);
    g.fillRect(bx + 9, by - 14, 30, 28);
    g.lineStyle(3, OUTLINE, 1);
    g.lineBetween(bx + 14, by - 6, bx + 34, by - 6);
    g.lineBetween(bx + 14, by + 3, bx + 34, by + 3);
    g.lineBetween(bx + 14, by + 12, bx + 26, by + 12);
    this.keep(this.text(r.x + 82, r.y + r.h / 2, t('almanac.title'), 30, true).setOrigin(0, 0.5));
  }

  /** Primary shortcut: start the next unlocked, uncompleted level without opening its world. */
  private drawNextLevelButton(): void {
    const r = NEXT_LEVEL_BUTTON;
    const g = this.keep(this.add.graphics());
    g.fillStyle(ACCENT, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    g.lineStyle(5, OUTLINE, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 18);
    const iy = r.y + r.h / 2;
    const ix = r.x + 34;
    g.fillStyle(0xfbf7f2, 1).fillTriangle(ix - 10, iy - 14, ix - 10, iy + 14, ix + 12, iy);
    this.keep(this.text(r.x + 62, iy, t('action.next'), 30, true, INK_LIGHT).setOrigin(0, 0.5));
  }

  /** Small red cells ride the route from world to world: the journey through the body. */
  private drawFlow(route: Point[]): void {
    const cells = Array.from({ length: 8 }, () => this.keep(this.add.image(0, 0, DOT_KEY).setDisplaySize(18, 18).setTint(0xc4565a)));
    const place = (progress: number): void =>
      cells.forEach((cell, k) => {
        const at = route[Math.floor(((progress + k / cells.length) % 1) * (route.length - 1))]!;
        cell.setPosition(at.x, at.y);
      });
    place(0);
    const counter = this.tweens.addCounter({ from: 0, to: 1, duration: 22000, repeat: -1, onUpdate: (c) => place(c.getValue() ?? 0) });
    this.tweensOfView.push(counter);
  }

  private drawWorld(world: MenuWorld, index: number): Phaser.GameObjects.Container {
    const pos = worldPos(index);
    const side = worldLabelSide(index);
    const soon = world.comingSoon;
    const active = index === this.selected;
    const holder = this.keep(this.add.container(pos.x, pos.y));

    const plate = this.add.graphics();
    plate.fillStyle(active ? PANEL : PLATE, 1);
    plate.fillCircle(0, 0, 78);
    plate.lineStyle(active ? 8 : 4, OUTLINE, soon ? 0.5 : 1);
    plate.strokeCircle(0, 0, 78);
    holder.add(plate);

    const bobber = this.add.container(0, 0);
    const emblem = this.add.image(0, 0, worldKey(index)).setDisplaySize(WORLD_SIZE, WORLD_SIZE).setAlpha(soon ? 0.5 : 1);
    bobber.add(emblem);
    holder.add(bobber);
    // Gentle bob, out of phase from world to world.
    this.tween({ targets: bobber, y: -6, duration: 1500 + (index % 3) * 220, delay: index * 140, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    if (soon) {
      const clock = this.add.image(46, side === 'above' ? 46 : -46, NODE_KEYS.coming_soon).setDisplaySize(44, 44);
      holder.add(clock);
    }

    // Number badge on the side away from the label.
    const badgeY = side === 'above' ? 50 : -50;
    const badge = this.add.graphics();
    badge.fillStyle(PANEL, 1);
    badge.fillCircle(-52, badgeY, 19);
    badge.lineStyle(5, OUTLINE, 1);
    badge.strokeCircle(-52, badgeY, 19);
    holder.add(badge);
    holder.add(this.text(-52, badgeY, world.id, 24, true).setOrigin(0.5));

    const lines = soon ? `${t(`world.${world.id}.name`)}\n${t('menu.coming_soon')}` : t(`world.${world.id}.name`);
    const label = this.add
      .text(0, side === 'above' ? -WORLD_SIZE / 2 - 14 : WORLD_SIZE / 2 + 14, lines, {
        fontFamily: FONT,
        fontSize: '24px',
        color: INK,
        fontStyle: active ? 'bold' : 'normal',
        align: 'center',
        wordWrap: { width: 230 },
        backgroundColor: LABEL_BG,
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, side === 'above' ? 1 : 0)
      .setAlpha(soon ? 0.8 : 1);
    holder.add(label);
    return holder;
  }

  /** Raises whichever world is hovered or pressed; the rest settle back. */
  private applyFocus(): void {
    if (this.view.kind !== 'map') return;
    const focus = this.pressed?.kind === 'world' ? this.pressed.index : this.hovered;
    this.nodes.forEach((node, i) => {
      const want = i === focus ? FOCUS_SCALE : 1;
      if (node.scale === want) return;
      this.tweens.killTweensOf(node);
      this.tween({ targets: node, scale: want, duration: 110, ease: 'Sine.easeOut' });
    });
  }

  // ---- level path --------------------------------------------------------------------------------

  private renderWorld(worldIndex: number): void {
    const world = this.menu[worldIndex]!;
    const levelList = world.levels.slice(0, LEVEL_COUNT_MAX);
    const count = levelList.length;

    // Backdrop: tinted panel, the world's illustrated scene, and a dark vignette frame.
    const tint = WORLD_TINTS[worldIndex] ?? PLATE;
    const light = Phaser.Display.Color.IntegerToColor(tint).lighten(22).color;
    const dark = Phaser.Display.Color.IntegerToColor(tint).darken(30).color;
    const bg = this.keep(this.add.graphics().setDepth(-8));
    bg.fillStyle(tint, 1);
    bg.fillRoundedRect(24, 124, 1232, 572, 28);
    const frame = this.keep(this.add.graphics().setDepth(-7));
    for (let i = 0; i < 4; i++) {
      frame.lineStyle(26 - i * 6, dark, 0.14 + i * 0.05);
      frame.strokeRoundedRect(24 + 14 - i * 3, 124 + 14 - i * 3, 1232 - 28 + i * 6, 572 - 28 + i * 6, 24);
    }
    frame.lineStyle(5, OUTLINE, 1);
    frame.strokeRoundedRect(24, 124, 1232, 572, 28);

    // The world's illustrated scene fills the panel, under the frame; until it has loaded the
    // plain tint shows, and the view redraws itself once it is there.
    const ready = loadWorldBackdrop(this, worldIndex, () => {
      if (this.view.kind === 'world' && this.view.index === worldIndex) this.render(false);
    });
    if (ready) {
      this.keep(this.add.image(24, 124, backdropKey(worldIndex)).setOrigin(0).setDisplaySize(BACKDROP_SIZE.w, BACKDROP_SIZE.h).setDepth(-7.5));
    }
    this.drawMotes(light);

    // Heading with the world's emblem and name.
    const name = this.keep(this.text(0, 40, t(`world.${world.id}.name`), 40, true).setOrigin(0, 0.5).setDepth(1));
    const left = 640 - (name.width + 84) / 2;
    const plaque = this.keep(this.add.graphics());
    plaque.fillStyle(PANEL, 1);
    plaque.fillRoundedRect(left - 28, 6, name.width + 84 + 56, 76, 38);
    plaque.lineStyle(5, OUTLINE, 1);
    plaque.strokeRoundedRect(left - 28, 6, name.width + 84 + 56, 76, 38);
    this.keep(this.add.image(left + 36, 44, worldKey(worldIndex)).setDisplaySize(64, 64).setDepth(1));
    name.setX(left + 84);

    this.drawBack();

    const points = levelList.map((_, i) => levelPos(i, count));
    const route = routePoints(points, ROUTE_SAMPLES);
    const g = this.keep(this.add.graphics());
    this.drawRibbon(g, route, 26, 14, VESSEL);
    const lastDone = levelList.reduce((last, l, i) => (l.state === 'completed' ? i : last), -1);
    if (lastDone > 0) this.drawRibbon(g, route, 26, 14, TRAVELLED, lastDone * ROUTE_SAMPLES);

    levelList.forEach((level, i) => this.nodes.push(this.drawLevel(level.id, level.state, i, count)));
  }

  private drawBack(): void {
    const r = BACK_BUTTON;
    const g = this.keep(this.add.graphics());
    g.fillStyle(PANEL, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 18);
    g.lineStyle(5, OUTLINE, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 18);
    this.keep(this.add.image(r.x + 14 + 24, r.y + r.h / 2, BACK_KEY).setDisplaySize(48, 48));
    this.keep(this.text(r.x + 76, r.y + r.h / 2, t('action.back'), 30, true).setOrigin(0, 0.5));
  }

  private drawLevel(levelId: string, state: MenuLevelState, index: number, count: number): Phaser.GameObjects.Container {
    const pos = levelPos(index, count);
    const side: LabelSide = levelLabelSide(index);
    const available = state === 'completed' || state === 'playable';
    const holder = this.keep(this.add.container(pos.x, pos.y));

    const node = this.add.image(0, 0, NODE_KEYS[state]).setDisplaySize(LEVEL_NODE_SIZE, LEVEL_NODE_SIZE);
    holder.add(node);
    if (state === 'playable') {
      this.tween({ targets: node, scale: node.scale * 1.1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const stateWord = { completed: t('menu.completed'), playable: t('action.play'), locked: t('menu.locked'), coming_soon: t('menu.coming_soon') }[state];
    const label = this.add
      .text(0, side === 'above' ? -LEVEL_NODE_SIZE / 2 - 8 : LEVEL_NODE_SIZE / 2 + 8, `${levelId}\n${t(`level.${levelId}.title`)}\n${stateWord}`, {
        fontFamily: FONT,
        fontSize: '24px',
        color: INK,
        align: 'center',
        wordWrap: { width: 190 },
        backgroundColor: LABEL_BG,
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5, side === 'above' ? 1 : 0)
      .setAlpha(available ? 1 : 0.8);
    holder.add(label);
    return holder;
  }

  // ---- input -------------------------------------------------------------------------------------

  private target(x: number, y: number): Target {
    if (this.fullscreen?.hit(x, y)) return { kind: 'fullscreen' };
    const difficulty = difficultyAt(x, y);
    if (difficulty) return { kind: 'difficulty', value: difficulty };
    if (this.view.kind === 'map') {
      if (this.nextLevel !== null && nextLevelHit(x, y)) return { kind: 'next' };
      if (almanacHit(x, y)) return { kind: 'almanac' };
      const w = worldAt(x, y, this.menu.length);
      return w === null ? null : { kind: 'world', index: w };
    }
    if (backHit(x, y)) return { kind: 'back' };
    const count = Math.min(this.menu[this.view.index]!.levels.length, LEVEL_COUNT_MAX);
    const l = levelAt(x, y, count);
    return l === null ? null : { kind: 'level', index: l };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const hit = this.view.kind === 'map' ? worldAt(pointer.x, pointer.y, this.menu.length) : null;
    if (hit === this.hovered) return;
    this.hovered = hit;
    this.applyFocus();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.pressed = this.target(pointer.x, pointer.y);
    this.applyFocus();
  }

  /** A tap counts only when press and release land on the same target, so a stray drag does nothing. */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const down = this.pressed;
    this.pressed = null;
    this.applyFocus();
    const up = this.target(pointer.x, pointer.y);
    if (!down || !up || down.kind !== up.kind) return;
    if ('index' in down && 'index' in up && down.index !== up.index) return;

    if (up.kind === 'fullscreen') {
      this.fullscreen?.toggle();
    } else if (up.kind === 'difficulty') {
      if (down.kind === 'difficulty' && down.value === up.value && up.value !== difficultyStore().load()) {
        difficultyStore().save(up.value);
        this.sepsisEntering = up.value === 'sepsis';
        this.render(false);
      }
    } else if (up.kind === 'next') {
      this.startNextLevel();
    } else if (up.kind === 'almanac') {
      this.scene.start('almanac');
    } else if (up.kind === 'back') {
      this.selected = this.view.kind === 'world' ? this.view.index : this.selected;
      lastWorld = null;
      this.view = { kind: 'map' };
      this.render(true);
    } else if (up.kind === 'world') {
      this.tapWorld(up.index);
    } else if (this.view.kind === 'world') {
      this.tapLevel(this.view.index, up.index);
    }
  }

  /** Starts the next level directly; opening the menu again lands on that level's world path. */
  private startNextLevel(): void {
    if (this.nextLevel === null) return;
    const world = this.menu.findIndex((w) => w.levels.some((level) => level.id === this.nextLevel));
    if (world >= 0) lastWorld = world;
    this.scene.start('game', { levelId: this.nextLevel });
  }

  private tapWorld(index: number): void {
    this.selected = index;
    const world = this.menu[index]!;
    if (world.comingSoon) {
      this.render(false);
      this.refuse(this.nodes[index], worldPos(index), t('menu.coming_soon'));
      return;
    }
    lastWorld = index;
    this.view = { kind: 'world', index };
    this.render(true);
  }

  private tapLevel(worldIndex: number, index: number): void {
    const level = this.menu[worldIndex]!.levels[index]!;
    if (level.state === 'playable' || level.state === 'completed') {
      lastWorld = worldIndex;
      this.scene.start('game', { levelId: level.id });
      return;
    }
    const word = level.state === 'locked' ? t('menu.locked') : t('menu.coming_soon');
    this.refuse(this.nodes[index], levelPos(index, Math.min(this.menu[worldIndex]!.levels.length, LEVEL_COUNT_MAX)), word);
  }

  /** Brief refusal feedback: the target shakes and a short note floats up from it. */
  private refuse(node: Phaser.GameObjects.Container | undefined, at: Point, word: string): void {
    if (node) {
      this.tweens.killTweensOf(node);
      node.x = at.x;
      this.tween({ targets: node, x: at.x + 10, duration: SHAKE_MS, yoyo: true, repeat: 2, onComplete: () => (node.x = at.x) });
    }
    const note = this.keep(
      this.add
        .text(at.x, at.y - 10, word, { fontFamily: FONT, fontSize: '26px', color: INK, fontStyle: 'bold', backgroundColor: '#FBF7F2', padding: { x: 12, y: 6 } })
        .setOrigin(0.5)
        .setDepth(10),
    );
    this.tween({ targets: note, y: at.y - 70, alpha: 0, delay: 500, duration: 700, onComplete: () => note.destroy() });
  }
}
