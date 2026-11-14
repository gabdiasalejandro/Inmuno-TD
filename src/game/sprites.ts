import type Phaser from 'phaser';

/**
 * Sprite pieces from `assets/sprites/<id>/{brazos,cuerpo,ojos}.svg`, picked up automatically:
 * a new character folder is loaded without touching this file. Every piece shares one
 * 256x256 frame (see docs/guia-estilo.md), so pieces stack at the same origin.
 */

export const PIECES = ['brazos', 'cuerpo', 'ojos'] as const;
export type Piece = (typeof PIECES)[number];

/** Design frame size of every sprite. */
export const FRAME = 256;
/** Ground line of the frame: the base of every character rests at about this y. */
export const GROUND_Y = 224;
/** Rasterized size of each piece; larger than the display size so the canvas can scale up crisply. */
export const RASTER = 384;

/**
 * Asset URLs. `no-inline` matters: Vite would otherwise inline these small files as
 * percent-encoded data URIs, which Phaser's SVG loader mistakes for base64 and fails on.
 */
const urls = import.meta.glob('../../assets/sprites/*/*.svg', { query: '?url&no-inline', import: 'default', eager: true }) as Record<
  string,
  string
>;

/** id -> piece -> url, only for characters that have all three pieces. */
const SPRITES = new Map<string, Record<Piece, string>>();
{
  const found = new Map<string, Partial<Record<Piece, string>>>();
  for (const [path, url] of Object.entries(urls)) {
    const match = /\/sprites\/([^/]+)\/([^/]+)\.svg$/.exec(path);
    if (!match) continue;
    const [, id, piece] = match as unknown as [string, string, string];
    if (!(PIECES as readonly string[]).includes(piece)) continue;
    const entry = found.get(id) ?? {};
    entry[piece as Piece] = url;
    found.set(id, entry);
  }
  for (const [id, pieces] of found) {
    if (PIECES.every((p) => pieces[p] !== undefined)) SPRITES.set(id, pieces as Record<Piece, string>);
  }
}

export function textureKey(id: string, piece: Piece): string {
  return `sprite:${id}:${piece}`;
}

/** Queues every sprite piece on the scene loader. Call from `preload()`. */
export function preloadSprites(scene: Phaser.Scene): void {
  for (const [id, pieces] of SPRITES) {
    for (const piece of PIECES) {
      const key = textureKey(id, piece);
      if (!scene.textures.exists(key)) scene.load.svg(key, pieces[piece], { width: RASTER, height: RASTER });
    }
  }
}

/** True when all three pieces of `id` are loaded as textures. */
export function hasSprite(scene: Phaser.Scene, id: string): boolean {
  return PIECES.every((piece) => scene.textures.exists(textureKey(id, piece)));
}
