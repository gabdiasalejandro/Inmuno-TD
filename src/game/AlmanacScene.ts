import Phaser from 'phaser';
import { levels, worlds } from '../data';
import { t } from '../i18n';
import {
  ALMANAC_BACK,
  BODY_W,
  BODY_X,
  LIST_PANEL,
  LIST_VIEW,
  PAGE_BOTTOM,
  PAGE_PANEL,
  STAGE,
  TEXT_W,
  TEXT_X,
  TILE_H,
  TILE_W,
  TITLE_POS,
  almanacBackHit,
  clampScroll,
  isDrag,
  scrollbar,
  tileAt,
  tileRect,
  visibleRange,
} from '../ui/almanacLayout';
import { createFullscreenButton, type FullscreenButton } from '../ui/FullscreenButton';
import { CANVAS_FULLSCREEN } from '../ui/fullscreenLayout';
import { pointInRect } from '../ui/layout';
import { ALMANAC_ENTRIES, discoveredIds, nameKeys, type AlmanacCategory, type AlmanacEntry } from '../ui/almanacModel';
import { Figure, createFigure } from './figures';
import { BACK_KEY, loadMenuSprites } from './menuSprites';
import { progressStore } from './progress';
import { FRAME, GROUND_Y, PIECES, RASTER, hasSprite, preloadSprites, textureKey } from './sprites';

const FONT = 'sans-serif';
const INK = '#3A2A2A';
/** Lighter ink for the character's own voice, so it reads as a different register from the facts. */
const SOFT_INK = '#7A6666';
const OUTLINE = 0x3a2a2a;
const PANEL = 0xfbf7f2;
const PLATE = 0xeed3cd;
const STAGE_FILL = 0xf3dcd6;
const QUOTE_FILL = 0xf6e9e4;
const SILHOUETTE = 0x4a3838;
const FALLBACK_FILL = 0xe1d9e8;
const CHIP_FILL: Record<AlmanacCategory, number> = {
  barrier: 0xf8d2ae,
  innate_cell: 0xe1d9e8,
  organ: 0xefe2c8,
  pathogen: 0xcbbff4,
};
const TOAST_MS = 1800;
/** Scroll inertia: px/ms speed below which it stops, and the time constant (ms) of its decay. */
const MIN_FLING = 0.02;
const FLING_DECAY_MS = 325;

type Target = { kind: 'tile'; index: number } | { kind: 'back' } | { kind: 'fullscreen' } | null;

/**
 * Almanac: a glossary of the characters the player has met. Facts on top, the character's own
 * humorous line below, kept visually apart (CLAUDE.md 5.4). Entries not reached yet show as a
 * silhouette and cannot be opened. Geometry in `almanacLayout`, the discovery rule in `almanacModel`.
 */
export class AlmanacScene extends Phaser.Scene {
  private discovered = new Set<string>();
  private selected = 0;
  private pressed: Target = null;
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  private figure: Figure | null = null;
  private toast: Phaser.GameObjects.Text | null = null;
  private fullscreen: FullscreenButton | null = null;

  /** List scrolling: a second camera clips the tiles to the panel; its scroll is the list offset. */
  private listCam!: Phaser.Cameras.Scene2D.Camera;
  private listLayer!: Phaser.GameObjects.Layer;
  private tiles: Phaser.GameObjects.GameObject[][] = [];
  private building: Phaser.GameObjects.GameObject[] | null = null;
  private frame: Phaser.GameObjects.Graphics | null = null;
  private bar: Phaser.GameObjects.Graphics | null = null;
  private scroll = 0;
  private fling = 0;
  private drag: { startY: number; startScroll: number; lastY: number; lastT: number; active: boolean } | null = null;

  constructor() {
    super('almanac');
  }

  preload(): void {
    loadMenuSprites(this);
    preloadSprites(this);
  }

  create(): void {
    // Progress is re-read on every visit so a level won since the last one unlocks its characters.
    this.discovered = discoveredIds(ALMANAC_ENTRIES, worlds, levels, progressStore().load().completed);
    const first = ALMANAC_ENTRIES.findIndex((e) => this.discovered.has(e.id));
    this.selected = Math.max(first, 0);
    this.pressed = null;
    this.toast = null;
    this.scroll = 0;
    this.fling = 0;
    this.drag = null;
    this.listLayer = this.add.layer();
    this.cameras.main.ignore(this.listLayer);
    this.listCam = this.cameras.add(LIST_VIEW.x, LIST_VIEW.y, LIST_VIEW.w, LIST_VIEW.h);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('wheel', this.onWheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointerupoutside', this.onPointerUp, this);
      this.input.off('wheel', this.onWheel, this);
      this.fullscreen?.destroy();
      this.fullscreen = null;
      this.figure = null;
    });

    this.render();
    this.cameras.main.fadeIn(180, 0xdd, 0xbd, 0xb8);
    this.listCam.fadeIn(180, 0xdd, 0xbd, 0xb8);
  }

  // ---- drawing helpers -------------------------------------------------------------------------

  private keep<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.dynamic.push(object);
    if (this.building) {
      // Part of a list tile: drawn by the clipping camera only, so it scrolls with the list.
      this.listLayer.add(object);
      this.cameras.main.ignore(object);
      this.building.push(object);
    } else {
      this.listCam.ignore(object);
    }
    return object;
  }

  private text(x: number, y: number, value: string, size: number, style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}): Phaser.GameObjects.Text {
    return this.keep(this.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color: INK, ...style }));
  }

  private box(x: number, y: number, w: number, h: number, radius: number, fill: number, lineWidth: number, lineAlpha = 1): Phaser.GameObjects.Graphics {
    const g = this.keep(this.add.graphics());
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, radius);
    if (lineWidth > 0) {
      g.lineStyle(lineWidth, OUTLINE, lineAlpha);
      g.strokeRoundedRect(x, y, w, h, radius);
    }
    return g;
  }

  /** The first translated key of the list, so a name still missing from the game dictionary falls back. */
  private firstTranslated(keys: string[]): string {
    const found = keys.find((key) => t(key) !== key);
    return t(found ?? keys[0]!);
  }

  private clear(): void {
    this.fullscreen?.destroy();
    this.fullscreen = null;
    this.figure?.destroy();
    this.figure = null;
    for (const object of this.dynamic) object.destroy();
    this.dynamic = [];
    this.tiles = [];
    this.frame = null;
    this.bar = null;
    this.toast = null;
  }

  private render(): void {
    this.clear();
    this.text(TITLE_POS.x, TITLE_POS.y, t('almanac.title'), 52, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    this.drawBack();
    this.drawList();
    this.drawPage(ALMANAC_ENTRIES[this.selected]);
    this.fullscreen = createFullscreenButton(this, CANVAS_FULLSCREEN);
  }

  private drawBack(): void {
    const r = ALMANAC_BACK;
    this.box(r.x, r.y, r.w, r.h, 18, PANEL, 5);
    this.keep(this.add.image(r.x + 14 + 24, r.y + r.h / 2, BACK_KEY).setDisplaySize(48, 48));
    this.text(r.x + 76, r.y + r.h / 2, t('action.back'), 30, { fontStyle: 'bold' }).setOrigin(0, 0.5);
  }

  /**
   * One character drawn as static pieces with its ground point at (x, ground). A silhouette is the
   * body and arms filled flat dark. Ids without a sprite get a plain shape so nothing crashes.
   */
  private thumb(id: string, x: number, ground: number, scale: number, silhouette: boolean): void {
    if (!hasSprite(this, id)) {
      const g = this.keep(this.add.graphics());
      g.fillStyle(silhouette ? SILHOUETTE : FALLBACK_FILL, 1).fillRoundedRect(x - 56 * scale, ground - 150 * scale, 112 * scale, 140 * scale, 18 * scale);
      if (!silhouette) g.lineStyle(8 * scale, OUTLINE, 1).strokeRoundedRect(x - 56 * scale, ground - 150 * scale, 112 * scale, 140 * scale, 18 * scale);
      return;
    }
    for (const piece of PIECES) {
      if (silhouette && piece === 'ojos') continue;
      const image = this.keep(
        this.add
          .image(x, ground, textureKey(id, piece))
          .setOrigin(0.5, GROUND_Y / FRAME)
          .setScale((FRAME / RASTER) * scale),
      );
      if (silhouette) image.setTint(SILHOUETTE).setTintMode(Phaser.TintModes.FILL);
    }
  }

  private drawList(): void {
    this.box(LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h, 24, PLATE, 5);
    ALMANAC_ENTRIES.forEach((entry, i) => {
      this.building = [];
      this.tiles.push(this.building);
      const r = tileRect(i);
      const open = this.discovered.has(entry.id);
      const active = i === this.selected && open;
      this.box(r.x, r.y, TILE_W, TILE_H, 16, active ? 0xfff4e0 : PANEL, active ? 8 : 4, open ? 1 : 0.5);
      this.thumb(entry.id, r.x + TILE_W / 2, r.y + 100, 0.42, !open);
      const label = open ? this.firstTranslated(nameKeys(entry)) : t('almanac.locked_name');
      this.text(r.x + TILE_W / 2, r.y + TILE_H - 8, label, 19, { fontStyle: 'bold', align: 'center', wordWrap: { width: TILE_W - 16 } }).setOrigin(0.5, 1);
    });
    // The panel border is redrawn over the tiles and kept still on screen while the list scrolls.
    this.building = [];
    this.frame = this.box(LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h, 24, 0xffffff, 5).setDepth(5);
    this.frame.clear().lineStyle(5, OUTLINE, 1).strokeRoundedRect(LIST_PANEL.x, LIST_PANEL.y, LIST_PANEL.w, LIST_PANEL.h, 24);
    this.building = null;
    this.bar = this.keep(this.add.graphics().setDepth(5));
    this.scroll = clampScroll(this.scroll, ALMANAC_ENTRIES.length);
    this.applyScroll();
  }

  /** Moves the clipping camera, hides tiles that are out of view and redraws the indicator. */
  private applyScroll(): void {
    this.listCam.setScroll(LIST_VIEW.x, LIST_VIEW.y + this.scroll);
    this.frame?.setY(this.scroll);
    const [first, last] = visibleRange(ALMANAC_ENTRIES.length, this.scroll);
    this.tiles.forEach((objects, i) => objects.forEach((o) => (o as Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }).setVisible(i >= first && i <= last)));
    if (!this.bar) return;
    this.bar.clear();
    const thumb = scrollbar(ALMANAC_ENTRIES.length, this.scroll);
    if (thumb) this.bar.fillStyle(OUTLINE, 0.45).fillRoundedRect(thumb.x, thumb.y, thumb.w, thumb.h, thumb.w / 2);
  }

  update(_time: number, delta: number): void {
    if (this.drag?.active || Math.abs(this.fling) < MIN_FLING) return;
    const next = clampScroll(this.scroll + this.fling * delta, ALMANAC_ENTRIES.length);
    // Hitting either end kills the momentum.
    this.fling = next === this.scroll + this.fling * delta ? this.fling * Math.exp(-delta / FLING_DECAY_MS) : 0;
    this.scroll = next;
    this.applyScroll();
  }

  private drawPage(entry: AlmanacEntry | undefined): void {
    this.box(PAGE_PANEL.x, PAGE_PANEL.y, PAGE_PANEL.w, PAGE_PANEL.h, 24, PANEL, 5);
    if (!entry || !this.discovered.has(entry.id)) return;

    // Stage with the animated character (the same figure system the board uses).
    this.box(STAGE.x, STAGE.y, STAGE.w, STAGE.h, 20, STAGE_FILL, 0);
    const ground = STAGE.y + STAGE.h - 26;
    const shadow = this.keep(this.add.graphics());
    shadow.fillStyle(0xd6b3ad, 1).fillEllipse(STAGE.x + STAGE.w / 2, ground + 2, 170, 26);
    this.figure = createFigure(this, entry.id, STAGE.x + STAGE.w / 2, ground, 1).idle();
    this.figure.root.setDepth(1);

    // Real name, category chip and the fact.
    const name = this.text(TEXT_X, 146, this.firstTranslated(nameKeys(entry)), 38, { fontStyle: 'bold', wordWrap: { width: TEXT_W } });
    const chipY = name.y + name.height + 8;
    const chip = this.text(TEXT_X + 14, chipY + 5, t(`almanac.category.${entry.category}`), 20, { fontStyle: 'bold' });
    this.box(TEXT_X, chipY, chip.width + 28, 34, 17, CHIP_FILL[entry.category], 3);
    chip.setDepth(1);
    const fact = this.text(TEXT_X, chipY + 34 + 14, t(`almanac.${entry.id}.fact`), 22, { lineSpacing: 5, wordWrap: { width: TEXT_W } });

    // Quote: anchored to the bottom of the page, lighter box, softer ink, italic, first person.
    const quote = this.text(BODY_X + 64, 0, t(`almanac.${entry.id}.quote`), 22, { fontStyle: 'italic', color: SOFT_INK, lineSpacing: 4, wordWrap: { width: BODY_W - 84 } });
    const quoteH = Math.max(quote.height + 28, 76);
    const quoteTop = PAGE_BOTTOM - quoteH;
    this.box(BODY_X, quoteTop, BODY_W, quoteH, 18, QUOTE_FILL, 2, 0.35).setDepth(2);
    quote.setY(quoteTop + (quoteH - quote.height) / 2).setDepth(3);
    this.text(BODY_X + 18, quoteTop + quoteH / 2, '“', 64, { fontStyle: 'bold', color: '#D6B3AD' }).setOrigin(0, 0.5).setDepth(3);

    // Optional note: the game's simplification and what happens in reality.
    if (entry.note) {
      this.drawNote(entry, Math.max(STAGE.y + STAGE.h, fact.y + fact.height) + 12);
    }
  }

  private drawNote(entry: AlmanacEntry, top: number): void {
    const LABEL_W = 132;
    const rows: Array<[string, string]> = [
      [t('almanac.note.game'), t(`almanac.${entry.id}.note_game`)],
      [t('almanac.note.real'), t(`almanac.${entry.id}.note_real`)],
    ];
    const texts = rows.map(([label, body]) => ({
      label: this.text(BODY_X + 16, 0, label, 18, { fontStyle: 'bold' }).setDepth(3),
      body: this.text(BODY_X + 16 + LABEL_W, 0, body, 19, { lineSpacing: 3, wordWrap: { width: BODY_W - 32 - LABEL_W } }).setDepth(3),
    }));
    const GAP = 8;
    const height = texts.reduce((sum, row) => sum + row.body.height, 0) + GAP * (texts.length - 1) + 20;
    this.box(BODY_X, top, BODY_W, height, 14, PLATE, 2, 0.5).setDepth(2);
    let y = top + 10;
    for (const row of texts) {
      row.label.setPosition(BODY_X + 16, y + 1);
      row.body.setY(y);
      y += row.body.height + GAP;
    }
  }

  // ---- input -------------------------------------------------------------------------------------

  private target(x: number, y: number): Target {
    if (this.fullscreen?.hit(x, y)) return { kind: 'fullscreen' };
    if (almanacBackHit(x, y)) return { kind: 'back' };
    const tile = tileAt(x, y, ALMANAC_ENTRIES.length, this.scroll);
    return tile === null ? null : { kind: 'tile', index: tile };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.pressed = this.target(pointer.x, pointer.y);
    this.fling = 0;
    this.drag = pointInRect(LIST_VIEW, pointer.x, pointer.y) ? { startY: pointer.y, startScroll: this.scroll, lastY: pointer.y, lastT: pointer.time, active: false } : null;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.drag;
    if (!drag || !pointer.isDown) return;
    if (!drag.active && isDrag(drag.startY, pointer.y)) drag.active = true;
    if (!drag.active) return;
    this.scroll = clampScroll(drag.startScroll + drag.startY - pointer.y, ALMANAC_ENTRIES.length);
    const dt = Math.max(1, pointer.time - drag.lastT);
    this.fling = 0.6 * this.fling + 0.4 * ((drag.lastY - pointer.y) / dt);
    drag.lastY = pointer.y;
    drag.lastT = pointer.time;
    this.applyScroll();
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!pointInRect(LIST_VIEW, pointer.x, pointer.y)) return;
    this.fling = 0;
    this.scroll = clampScroll(this.scroll + dy, ALMANAC_ENTRIES.length);
    this.applyScroll();
  }

  /** A tap counts only when press and release land on the same target and the press was not a drag. */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const down = this.pressed;
    const drag = this.drag;
    this.pressed = null;
    this.drag = null;
    if (drag?.active) {
      // A release after a pause carries no momentum.
      if (pointer.time - drag.lastT > 80) this.fling = 0;
      return;
    }
    this.fling = 0;
    const up = this.target(pointer.x, pointer.y);
    if (!down || !up || down.kind !== up.kind) return;
    if (up.kind === 'fullscreen') {
      this.fullscreen?.toggle();
      return;
    }
    if (up.kind === 'back') {
      this.scene.start('menu');
      return;
    }
    if (down.kind !== 'tile' || down.index !== up.index) return;
    const entry = ALMANAC_ENTRIES[up.index];
    if (!entry) return;
    if (this.discovered.has(entry.id)) {
      if (up.index === this.selected) return;
      this.selected = up.index;
      this.render();
    } else {
      this.refuse(up.index);
    }
  }

  /** A locked entry only answers with a short note: it cannot be opened. */
  private refuse(index: number): void {
    const r = tileRect(index, this.scroll);
    this.toast?.destroy();
    const note = this.add
      .text(LIST_PANEL.x + LIST_PANEL.w / 2, Math.min(Math.max(r.y + r.h / 2, LIST_VIEW.y + 40), LIST_VIEW.y + LIST_VIEW.h - 40), t('almanac.locked_hint'), {
        fontFamily: FONT,
        fontSize: '22px',
        color: INK,
        fontStyle: 'bold',
        align: 'center',
        backgroundColor: '#FBF7F2',
        padding: { x: 14, y: 10 },
        wordWrap: { width: LIST_PANEL.w - 80 },
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.toast = note;
    this.listCam.ignore(note);
    this.tweens.add({
      targets: note,
      alpha: 0,
      delay: TOAST_MS,
      duration: 400,
      onComplete: () => {
        note.destroy();
        if (this.toast === note) this.toast = null;
      },
    });
  }
}
