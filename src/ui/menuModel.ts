import { isUnlocked } from '../game/progress';

/** What the menu draws for one level. Phaser-free so it can be tested headless. */
export type MenuLevelState = 'completed' | 'playable' | 'locked' | 'coming_soon';

export interface MenuLevel {
  id: string;
  state: MenuLevelState;
}

export interface MenuWorld {
  id: string;
  /** True when the world has no levels at all. */
  comingSoon: boolean;
  levels: MenuLevel[];
}

export interface MenuWorldInput {
  id: string;
  levels: string[];
}

/**
 * A level without data is always coming soon, whatever its unlock state. Otherwise completed wins,
 * then `isUnlocked` decides between playable and locked.
 */
export function buildMenu(
  worlds: readonly MenuWorldInput[],
  available: ReadonlySet<string>,
  completed: readonly string[],
): MenuWorld[] {
  return worlds.map((world) => ({
    id: world.id,
    comingSoon: world.levels.length === 0,
    levels: world.levels.map((id): MenuLevel => {
      if (!available.has(id)) return { id, state: 'coming_soon' };
      if (completed.includes(id)) return { id, state: 'completed' };
      const unlocked = isUnlocked(world.levels, [...completed], id);
      return { id, state: unlocked ? 'playable' : 'locked' };
    }),
  }));
}

/**
 * The level a "next level" shortcut should start: the first one that is unlocked and not yet
 * completed, in menu order. Null when there is nothing left to play (everything built is done).
 */
export function nextPlayableLevel(menu: readonly MenuWorld[]): string | null {
  for (const world of menu) {
    for (const level of world.levels) {
      if (level.state === 'playable') return level.id;
    }
  }
  return null;
}
