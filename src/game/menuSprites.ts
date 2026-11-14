import type Phaser from 'phaser';
import world1 from '../../assets/sprites/mundos/1/mundo.svg?url&no-inline';
import world2 from '../../assets/sprites/mundos/2/mundo.svg?url&no-inline';
import world3 from '../../assets/sprites/mundos/3/mundo.svg?url&no-inline';
import world4 from '../../assets/sprites/mundos/4/mundo.svg?url&no-inline';
import world5 from '../../assets/sprites/mundos/5/mundo.svg?url&no-inline';
import world6 from '../../assets/sprites/mundos/6/mundo.svg?url&no-inline';
import world7 from '../../assets/sprites/mundos/7/mundo.svg?url&no-inline';
import world8 from '../../assets/sprites/mundos/8/mundo.svg?url&no-inline';
import back from '../../assets/sprites/mundos/ui/back.svg?url&no-inline';
import dot from '../../assets/sprites/mundos/ui/dot.svg?url&no-inline';
import nodeCompleted from '../../assets/sprites/mundos/ui/node_completed.svg?url&no-inline';
import nodeLocked from '../../assets/sprites/mundos/ui/node_locked.svg?url&no-inline';
import nodePlayable from '../../assets/sprites/mundos/ui/node_playable.svg?url&no-inline';
import nodeSoon from '../../assets/sprites/mundos/ui/node_soon.svg?url&no-inline';
import type { MenuLevelState } from '../ui/menuModel';

/**
 * Texture keys and loader for the world map. Emblems are rasterized at 3x their on-screen size.
 * Imports use `&no-inline`: Vite inlines small assets as non-base64 data URIs, which Phaser's loader cannot decode.
 */

const WORLD_URLS = [world1, world2, world3, world4, world5, world6, world7, world8];
const WORLD_RASTER = 384;
const NODE_RASTER = 192;

export const worldKey = (index: number): string => `menu-world-${index + 1}`;
export const NODE_KEYS: Record<MenuLevelState, string> = {
  completed: 'menu-node-completed',
  playable: 'menu-node-playable',
  locked: 'menu-node-locked',
  coming_soon: 'menu-node-soon',
};
export const BACK_KEY = 'menu-back';
export const DOT_KEY = 'menu-dot';

/** Queues every menu texture that is not loaded yet. Call from `preload`. */
export function loadMenuSprites(scene: Phaser.Scene): void {
  const queue = (key: string, url: string, size: number): void => {
    if (!scene.textures.exists(key)) scene.load.svg(key, url, { width: size, height: size });
  };
  WORLD_URLS.forEach((url, i) => queue(worldKey(i), url, WORLD_RASTER));
  queue(NODE_KEYS.completed, nodeCompleted, NODE_RASTER);
  queue(NODE_KEYS.playable, nodePlayable, NODE_RASTER);
  queue(NODE_KEYS.locked, nodeLocked, NODE_RASTER);
  queue(NODE_KEYS.coming_soon, nodeSoon, NODE_RASTER);
  queue(BACK_KEY, back, NODE_RASTER);
  queue(DOT_KEY, dot, 64);
}

/** Soft backdrop tint per world, drawn behind its level path. Same muted family as the game field. */
export const WORLD_TINTS = [0xe2c7a8, 0xcfb2d2, 0xe6b9ab, 0xb9cbe0, 0xdcc9a3, 0xb3b896, 0xe6b2a8, 0xb69aa8];
