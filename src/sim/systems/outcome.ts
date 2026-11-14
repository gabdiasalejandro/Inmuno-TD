import { secondsToTicks } from '../time';
import type { System, World } from '../world';

/** Decides defeat first, then the level's win condition. */
export function createOutcome(world: World, allSpawned: () => boolean): System {
  const { level, state } = world;
  const win = level.win ?? { type: 'clear' };

  return (events) => {
    if (state.enemies.some((enemy) => enemy.pos <= 0)) {
      state.status = 'lost';
      events.push({ type: 'lost' });
      return;
    }
    const won =
      win.type === 'survive'
        ? state.tick >= secondsToTicks(win.seconds)
        : allSpawned() && state.enemies.length === 0;
    if (!won) return;
    state.status = 'won';
    events.push({ type: 'won' });
  };
}
