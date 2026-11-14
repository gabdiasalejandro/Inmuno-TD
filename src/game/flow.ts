/** Level-to-level flow decisions. Phaser-free so they can be tested headless. */

export type ResultAction = 'next' | 'retry' | 'menu';

/**
 * The level after `levelId` in play order across all worlds, or null when there is none or it
 * is listed but not built yet (absent from `levels`).
 */
export function nextLevelId(levelId: string, worlds: Array<{ levels: string[] }>, levels: Record<string, unknown>): string | null {
  const order = worlds.flatMap((world) => world.levels);
  const index = order.indexOf(levelId);
  if (index < 0) return null;
  const next = order[index + 1];
  return next !== undefined && Object.hasOwn(levels, next) ? next : null;
}

/** Buttons of the end-of-level overlay, in display order. "Next" only after a win. */
export function resultActions(status: 'won' | 'lost', next: string | null): ResultAction[] {
  return status === 'won' && next !== null ? ['next', 'retry', 'menu'] : ['retry', 'menu'];
}
