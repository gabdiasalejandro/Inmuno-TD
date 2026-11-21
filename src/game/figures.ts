import type Phaser from 'phaser';
import { FRAME, GROUND_Y, PIECES, RASTER, hasSprite, textureKey } from './sprites';

/**
 * The only module that knows what a unit or enemy looks like and how it moves.
 * A figure is the character's three SVG pieces (brazos, cuerpo, ojos) stacked in one frame and
 * animated with tweens, following the motion notes of docs/guia-estilo.md. Ids without a
 * sprite get a plain fallback shape so new content never crashes the scene.
 *
 * Coordinates inside a figure are design-frame pixels relative to the ground point
 * (frame x 128, y GROUND_Y); the figure's position is that ground point on screen.
 */

/** Same factor for every character on the board, relative to the 256 px frame. */
export const BOARD_SCALE = 0.48;

const OUTLINE = 0x3a2a2a;
const FALLBACK_FILL = 0xe1d9e8;
/** Multiply tint for unusable cards and expiring tissue. */
const DIM_TINT = 0xbdb3b3;

type Motion = 'wall' | 'jelly' | 'crawler' | 'worker' | 'heavy' | 'rush';

interface CharacterSpec {
  motion: Motion;
  /** Eye centres in frame pixels, for blinking. */
  eyes: Array<[number, number]>;
  /** Body colour used for the eyelid when blinking. */
  lid: number;
  /** Frame x of the front edge for enemies (their face side, looking left). */
  front?: number;
  /** Pattern-recognition receptors in frame pixels; they glow while the unit detects a PAMP. */
  receptors?: Array<[number, number]>;
  /** Frame centre and radius of the spot where a swallowed bacterium shows. Easy to reposition. */
  belly?: [number, number, number];
}

const CHARACTERS: Record<string, CharacterSpec> = {
  epitelio: { motion: 'wall', eyes: [[105, 112], [151, 112]], lid: 0xedb07f },
  moco: { motion: 'jelly', eyes: [[108, 132], [152, 132]], lid: 0xcfe39b },
  bacteria_gram_pos: { motion: 'crawler', eyes: [[80, 136], [114, 136]], lid: 0x7452e0, front: 56 },
  // Proposal pending review: a chain of cocci, face on the leading coccus.
  streptococcus_pyogenes: { motion: 'crawler', eyes: [[72, 134], [106, 134]], lid: 0xe04a5a, front: 52 },
  medula_osea: { motion: 'worker', eyes: [[106, 84], [150, 84]], lid: 0xefe2c8 },
  macrofago: {
    motion: 'heavy',
    eyes: [[140, 104], [184, 104]],
    lid: 0xfbf7f2,
    // Same four circles as <g id="prr"> in assets/sprites/macrofago/cuerpo.svg.
    receptors: [[160, 48], [177, 56], [203, 88], [211, 124]],
    belly: [153, 178, 16],
  },
  // Tutor: friendly teacher, calm breathing and a gentle wave of its branches.
  dendritica: { motion: 'worker', eyes: [[106, 112], [150, 112]], lid: 0xfbf7f2 },
  neutrofilo: { motion: 'rush', eyes: [[142, 124], [182, 124]], lid: 0xfbf7f2, belly: [198, 178, 11] },
  // Proposal pending review: calm, poised idle; drawn in assets/sprites/nk/.
  nk: { motion: 'worker', eyes: [[104, 128], [150, 128]], lid: 0xb791be },
  // Proposal pending review: a small enveloped virion with glycoprotein spikes, face on the left.
  virus: { motion: 'crawler', eyes: [[100, 150], [134, 150]], lid: 0x36b862, front: 66 },
};

/** Colour of a swallowed bacterium (the gram-positive body colour) and of the receptor glow. */
const SWALLOWED = 0x9e86f2;
const SWALLOWED_EDGE = 0x5435b8;
const ALARM_GLOW = 0xf7c56e;

const DEFAULT_SPEC: CharacterSpec = { motion: 'wall', eyes: [], lid: FALLBACK_FILL };

/** Linear blend of two 0xRRGGBB colours, t in 0..1. */
function lerpColor(a: number, b: number, t: number): number {
  const ch = (c: number, shift: number): number => (c >> shift) & 0xff;
  const mix = (shift: number): number => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

function frameX(x: number): number {
  return x - FRAME / 2;
}

function frameY(y: number): number {
  return y - GROUND_Y;
}

/** Horizontal distance, in frame pixels, from an enemy's ground point to its front edge. */
export function frontOffset(defId: string): number {
  const front = CHARACTERS[defId]?.front ?? 40;
  return FRAME / 2 - front;
}

export class Figure {
  /** Ground point on screen; carries the base scale and long-lived deformation (wear). */
  readonly root: Phaser.GameObjects.Container;
  /** One-shot motions: pop, hit, attack, death. */
  private readonly pose: Phaser.GameObjects.Container;
  /** Digestion wobble, driven per frame, plus the overlays that must wobble with the body. */
  private readonly gulp: Phaser.GameObjects.Container;
  private alarmG: Phaser.GameObjects.Graphics | null = null;
  private bellyG: Phaser.GameObjects.Graphics | null = null;
  private excite = 0;
  /** Looping motions: breathing, wobble, hop. */
  private readonly body: Phaser.GameObjects.Container;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly arms: Phaser.GameObjects.GameObject | null;
  private readonly lids: Phaser.GameObjects.Graphics | null;
  private readonly spec: CharacterSpec;
  private readonly scale: number;
  private loops: Phaser.Tweens.Tween[] = [];
  private blinkTimer: Phaser.Time.TimerEvent | null = null;
  private moving = false;
  private dying = false;
  private dimmed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly defId: string,
    x: number,
    y: number,
    scale: number,
  ) {
    this.spec = CHARACTERS[defId] ?? DEFAULT_SPEC;
    this.scale = scale;
    this.root = scene.add.container(x, y).setScale(scale);
    this.pose = scene.add.container(0, 0);
    this.body = scene.add.container(0, 0);
    this.gulp = scene.add.container(0, 0);
    this.root.add(this.pose);
    this.pose.add(this.gulp);
    this.gulp.add(this.body);

    if (hasSprite(scene, defId)) {
      for (const piece of PIECES) {
        const image = scene.add
          .image(0, 0, textureKey(defId, piece))
          .setOrigin(0.5, GROUND_Y / FRAME)
          .setScale(FRAME / RASTER);
        this.images.push(image);
        this.body.add(image);
      }
      this.arms = this.images[0] ?? null;
      this.lids = scene.add.graphics().setVisible(false);
      this.body.add(this.lids);
      this.drawLids();
      // Overlays follow the idle animation because they live in the body container.
      if (this.spec.receptors) {
        this.alarmG = scene.add.graphics().setVisible(false);
        this.body.add(this.alarmG);
      }
      if (this.spec.belly) {
        this.bellyG = scene.add.graphics().setVisible(false);
        this.body.add(this.bellyG);
      }
    } else {
      const g = scene.add.graphics();
      g.fillStyle(FALLBACK_FILL, 1).fillRoundedRect(-56, -150, 112, 140, 18);
      g.lineStyle(8, OUTLINE, 1).strokeRoundedRect(-56, -150, 112, 140, 18);
      this.body.add(g);
      this.arms = null;
      this.lids = null;
    }
  }

  setPosition(x: number, y: number): this {
    if (!this.dying) this.root.setPosition(x, y);
    return this;
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  setAlpha(alpha: number): this {
    this.root.setAlpha(alpha);
    return this;
  }

  setVisible(visible: boolean): this {
    this.root.setVisible(visible);
    return this;
  }

  /** Greys the figure out, e.g. on a card that cannot be used right now. */
  setDim(dim: boolean): this {
    if (dim === this.dimmed) return this;
    this.dimmed = dim;
    for (const image of this.images) {
      if (dim) image.setTint(DIM_TINT);
      else image.clearTint();
    }
    return this;
  }

  /** Starts the looping idle motion of the character and its blinking. */
  idle(): this {
    this.stopLoops();
    const tweens = this.scene.tweens;
    const loop = (config: Phaser.Types.Tweens.TweenBuilderConfig): void => {
      this.loops.push(tweens.add({ yoyo: true, repeat: -1, ease: 'Sine.easeInOut', ...config }));
    };
    const offset = Math.random() * 600;
    switch (this.spec.motion) {
      case 'wall':
        // Slow breathing anchored at the base, arms swaying 2-3 degrees.
        loop({ targets: this.body, scaleY: 1.025, scaleX: 0.995, duration: 1000, delay: offset });
        if (this.arms) loop({ targets: this.arms, angle: 2.5, duration: 1300, delay: offset });
        break;
      case 'jelly':
        // Jelly wobble: 1.03 x 0.97 <-> 0.97 x 1.03 every 1.5 s, drips trailing behind.
        this.body.setScale(0.97, 1.03);
        loop({ targets: this.body, scaleX: 1.03, scaleY: 0.97, duration: 750, delay: offset });
        if (this.arms) loop({ targets: this.arms, y: 6, duration: 750, delay: offset + 220 });
        break;
      case 'crawler':
        this.applyCrawl();
        break;
      case 'worker':
        loop({ targets: this.body, scaleY: 1.03, scaleX: 0.99, duration: 900, delay: offset });
        if (this.arms) loop({ targets: this.arms, angle: -3, duration: 450, delay: offset });
        break;
      case 'heavy':
        // Heavy, slow breathing anchored at the base; the pseudopods feel their way around.
        loop({ targets: this.body, scaleX: 1.02, scaleY: 0.98, duration: 1200, delay: offset });
        if (this.arms) loop({ targets: this.arms, angle: 4, duration: 1500, delay: offset });
        break;
      case 'rush':
        // Impatient: small hops and a forward sway, the fist trembling.
        loop({ targets: this.body, y: -2, duration: 250, delay: offset, ease: 'Quad.easeOut' });
        loop({ targets: this.body, angle: 3, duration: 700, delay: offset });
        if (this.arms) loop({ targets: this.arms, y: 2, duration: 110 });
        break;
    }
    this.scheduleBlink();
    this.applyExcite();
    return this;
  }

  /** Bacteria: hop while walking, legs and tail shuffle; stand still when blocked. */
  setMoving(moving: boolean): this {
    if (this.spec.motion !== 'crawler' || moving === this.moving || this.dying) return this;
    this.moving = moving;
    this.applyCrawl();
    return this;
  }

  private applyCrawl(): void {
    this.stopLoops();
    const tweens = this.scene.tweens;
    if (this.moving) {
      this.loops.push(tweens.add({ targets: this.body, y: -7, duration: 200, yoyo: true, repeat: -1, ease: 'Quad.easeOut' }));
      if (this.arms) {
        this.loops.push(tweens.add({ targets: this.arms, scaleX: (FRAME / RASTER) * 0.93, duration: 200, yoyo: true, repeat: -1, delay: 100, ease: 'Sine.easeInOut' }));
      }
    } else {
      this.loops.push(tweens.add({ targets: this.body, scaleY: 1.04, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
  }

  /** Placement pop: grows from the ground with a small overshoot. */
  pop(): this {
    this.pose.setScale(0.2, 0.2);
    this.scene.tweens.add({ targets: this.pose, scaleX: 1, scaleY: 1, duration: 360, ease: 'Back.easeOut' });
    return this;
  }

  /** Reaction to being attacked. */
  hit(): this {
    if (this.dying) return this;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    this.pose.setPosition(0, 0).setScale(1).setAngle(0);
    if (this.spec.motion === 'jelly') {
      tweens.add({ targets: this.pose, scaleX: 1.1, scaleY: 0.9, duration: 100, yoyo: true, ease: 'Sine.easeOut' });
    } else if (this.spec.motion === 'crawler') {
      tweens.add({ targets: this.pose, x: 8, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    } else {
      // Brace: drop a little and widen, then shake sideways.
      tweens.add({ targets: this.pose, y: 8, scaleX: 1.05, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
      tweens.add({ targets: this.pose, x: { from: -6, to: 6 }, duration: 45, yoyo: true, repeat: 1, onComplete: () => this.pose.setX(0) });
    }
    this.flash();
    return this;
  }

  /** Enemy bite or ram toward the left: lean back, lunge, settle. */
  attack(): this {
    if (this.dying) return this;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    this.pose.setPosition(0, 0).setScale(1).setAngle(0);
    tweens.chain({
      targets: this.pose,
      tweens: [
        { x: 12, angle: 4, duration: 110, ease: 'Quad.easeOut' },
        { x: -20, angle: -6, scaleX: 1.08, scaleY: 0.94, duration: 90, ease: 'Quad.easeIn' },
        { x: 0, angle: 0, scaleX: 1, scaleY: 1, duration: 220, ease: 'Sine.easeOut' },
      ],
    });
    return this;
  }

  /**
   * 0 = fresh, 1 = about to expire. Tissue with a lifespan sags, widens and loses colour,
   * and its wobble quickens near the end, so the player sees it giving out.
   */
  setWear(wear: number, now: number): this {
    if (this.dying) return this;
    const w = Math.max(0, Math.min(1, wear));
    const sag = w * w;
    const tremble = w > 0.75 ? Math.sin(now / 70) * 0.02 * (w - 0.75) * 4 : 0;
    this.root.setScale(this.scale * (1 + 0.14 * sag + tremble), this.scale * (1 - 0.3 * sag - tremble));
    const color = lerpColor(0xffffff, 0xb9b0a0, w);
    for (const image of this.images) image.setTint(color);
    return this;
  }

  /** Exit animation; the figure destroys itself when done. */
  die(cause: 'killed' | 'expired' = 'killed'): void {
    if (this.dying) return;
    this.dying = true;
    this.stopLoops();
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    const done = (): void => this.destroy();
    if (this.spec.motion === 'crawler') {
      // Spins 90 degrees and shrinks away.
      tweens.add({ targets: this.pose, angle: 90, scaleX: 0, scaleY: 0, duration: 380, ease: 'Back.easeIn', onComplete: done });
    } else if (this.spec.motion === 'jelly' || cause === 'expired') {
      // Melts into a puddle and fades.
      tweens.add({ targets: this.pose, scaleY: 0.15, scaleX: 1.3, duration: 420, ease: 'Quad.easeIn' });
      tweens.add({ targets: this.root, alpha: 0, duration: 420, delay: 160, onComplete: done });
    } else {
      // Sinks toward its base and flattens.
      tweens.add({ targets: this.pose, scaleY: 0.1, scaleX: 1.2, y: 6, duration: 300, ease: 'Quad.easeIn' });
      tweens.add({ targets: this.root, alpha: 0, duration: 260, delay: 160, onComplete: done });
    }
  }

  /** A short squash used by producers (the bone marrow) when they release something. */
  squeeze(): this {
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    this.pose.setScale(1);
    tweens.add({ targets: this.pose, scaleX: 1.12, scaleY: 0.88, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    return this;
  }

  /** Extra scale on top of the base scale, e.g. a producer swelling as it charges. */
  setSwell(amount: number): this {
    if (!this.dying) this.root.setScale(this.scale * (1 + amount), this.scale * (1 + amount));
    return this;
  }

  /** Speeds up the idle loops, 0 (normal) to 1 (three times as fast): a producer working harder. */
  setExcite(amount: number): this {
    this.excite = Math.max(0, Math.min(1, amount));
    this.applyExcite();
    return this;
  }

  private applyExcite(): void {
    for (const tween of this.loops) tween.setTimeScale(1 + 2 * this.excite);
  }

  /** Receptors glow while the cell detects a PAMP (pulsing, with a halo). Cheap to call per frame. */
  setAlarm(on: boolean, now: number): this {
    const g = this.alarmG;
    const receptors = this.spec.receptors;
    if (!g || !receptors) return this;
    g.setVisible(on && !this.dying);
    if (!on) return this;
    const pulse = 0.5 + 0.5 * Math.sin(now / 90);
    g.clear();
    receptors.forEach(([cx, cy], i) => {
      const k = 0.5 + 0.5 * Math.sin(now / 90 + i * 0.9);
      const x = frameX(cx);
      const y = frameY(cy);
      g.fillStyle(ALARM_GLOW, 0.3 + 0.3 * pulse).fillCircle(x, y, 22 + 7 * k);
      g.fillStyle(0xfffdf5, 1).fillCircle(x, y, 8);
      g.lineStyle(5, ALARM_GLOW, 0.95).strokeCircle(x, y, 13 + 3 * k);
    });
    return this;
  }

  /**
   * Phagocytosis lunge: dip, then snap forward and swell as the prey is swallowed, then settle.
   * The macrophage is slower and heavier than the neutrophil's quick gulp.
   */
  engulf(): this {
    if (this.dying) return this;
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    this.pose.setPosition(0, 0).setScale(1).setAngle(0);
    const heavy = this.spec.motion === 'heavy';
    tweens.chain({
      targets: this.pose,
      tweens: heavy
        ? [
            { scaleX: 0.96, scaleY: 1.04, duration: 120, ease: 'Quad.easeOut' },
            { x: 26, scaleX: 1.14, scaleY: 0.9, angle: 3, duration: 160, ease: 'Quad.easeIn' },
            { x: 0, scaleX: 1.04, scaleY: 0.97, angle: 0, duration: 320, ease: 'Sine.easeOut' },
            { scaleX: 1, scaleY: 1, duration: 200 },
          ]
        : [
            { y: 4, scaleX: 1.06, scaleY: 0.94, duration: 70, ease: 'Quad.easeOut' },
            { x: 30, angle: 6, scaleX: 1.1, scaleY: 0.92, duration: 100, ease: 'Quad.easeIn' },
            { x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, duration: 200, ease: 'Sine.easeOut' },
          ],
    });
    return this;
  }

  /**
   * Digestion after a bite: bubbles rise inside the cell and the body tints violet for `duration`
   * milliseconds, so the player sees the phagocyte busy with what it just ate. Self-cleaning.
   */
  digest(duration = 1000): this {
    if (this.dying) return this;
    const g = this.scene.add.graphics();
    this.root.add(g);
    const tint = 0xd9c4f0;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        if (!g.active) return;
        const k = tween.getValue() ?? 0;
        g.clear();
        for (let i = 0; i < 4; i++) {
          const phase = (k * 1.6 + i * 0.25) % 1;
          const x = (i - 1.5) * 10 + Math.sin(phase * Math.PI * 2 + i) * 3;
          const y = -14 - phase * 30;
          const r = 3.5 + 2 * (1 - phase);
          g.fillStyle(0xfbf7f2, 0.85 * (1 - phase)).fillCircle(x, y, r);
          g.lineStyle(2, OUTLINE, 0.8 * (1 - phase)).strokeCircle(x, y, r);
        }
        const pulse = Math.sin(k * Math.PI * 3);
        for (const image of this.images) image.setTint(lerpColor(0xffffff, tint, Math.max(0, pulse)));
      },
      onComplete: () => {
        for (const image of this.images) image.clearTint();
        g.destroy();
      },
    });
    return this;
  }

  /**
   * Digestion after a bite: `fraction` 1 (just swallowed) to 0 (ready). A bacterium shows in the
   * belly and shrinks; the macrophage also wobbles slowly and contentedly. Call every frame.
   */
  setDigest(fraction: number, now: number): this {
    const g = this.bellyG;
    const belly = this.spec.belly;
    const f = Math.max(0, Math.min(1, fraction));
    const heavy = this.spec.motion === 'heavy';
    if (heavy && !this.dying) {
      const wobble = f > 0 ? Math.sin(now / 260) * 0.03 * Math.min(1, f * 3) : 0;
      this.gulp.setScale(1 + wobble, 1 - wobble);
    }
    if (!g || !belly) return this;
    g.setVisible(f > 0 && !this.dying);
    if (f <= 0) return this;
    const [cx, cy, r] = belly;
    const x = frameX(cx) + Math.sin(now / 200) * 2;
    const y = frameY(cy) + Math.cos(now / 170) * 1.5;
    const size = r * (0.35 + 0.65 * f);
    g.clear();
    g.fillStyle(SWALLOWED, 1).fillEllipse(x, y, size * 2.2, size * 1.6);
    g.lineStyle(4, SWALLOWED_EDGE, 1).strokeEllipse(x, y, size * 2.2, size * 1.6);
    return this;
  }

  /** The prey's side of phagocytosis: pulled into (x, y) on screen while spinning and shrinking away. */
  engulfedInto(x: number, y: number): void {
    if (this.dying) return;
    this.dying = true;
    this.stopLoops();
    const tweens = this.scene.tweens;
    tweens.killTweensOf(this.pose);
    tweens.add({ targets: this.root, x, y, scaleX: 0, scaleY: 0, angle: -200, duration: 340, ease: 'Quad.easeIn', onComplete: () => this.destroy() });
  }

  destroy(): void {
    this.stopLoops();
    this.blinkTimer?.remove();
    this.blinkTimer = null;
    this.scene.tweens.killTweensOf(this.pose);
    this.scene.tweens.killTweensOf(this.root);
    this.root.destroy();
  }

  private stopLoops(): void {
    for (const tween of this.loops) tween.remove();
    this.loops = [];
    this.body.setPosition(0, 0).setScale(1).setAngle(0);
    if (this.arms) (this.arms as Phaser.GameObjects.Image).setPosition(0, 0).setAngle(0).setScale(FRAME / RASTER);
  }

  private flash(): void {
    if (this.images.length === 0) return;
    for (const image of this.images) image.setTint(0xffd9d0);
    this.scene.time.delayedCall(90, () => {
      if (this.dying || !this.root.active) return;
      for (const image of this.images) {
        if (this.dimmed) image.setTint(DIM_TINT);
        else image.clearTint();
      }
    });
  }

  /** Closed eyes: a lid of body colour over each eye with a lash line. */
  private drawLids(): void {
    const g = this.lids;
    if (!g) return;
    for (const [cx, cy] of this.spec.eyes) {
      const x = frameX(cx);
      const y = frameY(cy);
      g.fillStyle(this.spec.lid, 1).fillEllipse(x, y, 26, 32);
      g.lineStyle(5, OUTLINE, 1);
      g.beginPath();
      g.moveTo(x - 11, y + 1);
      g.lineTo(x, y + 4);
      g.lineTo(x + 11, y + 1);
      g.strokePath();
    }
  }

  private scheduleBlink(): void {
    if (!this.lids || this.spec.eyes.length === 0) return;
    this.blinkTimer?.remove();
    this.blinkTimer = this.scene.time.delayedCall(2200 + Math.random() * 3200, () => {
      if (!this.root.active || this.dying) return;
      this.lids?.setVisible(true);
      this.scene.time.delayedCall(110, () => {
        if (!this.root.active) return;
        this.lids?.setVisible(false);
        this.scheduleBlink();
      });
    });
  }
}

/** Creates the figure of `defId` with its ground point at (x, y). */
export function createFigure(scene: Phaser.Scene, defId: string, x: number, y: number, scale = BOARD_SCALE): Figure {
  return new Figure(scene, defId, x, y, scale);
}
