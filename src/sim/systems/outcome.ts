import { secondsToTicks } from '../time';
import type { DefeatCause } from '../types';
import type { System, World } from '../world';

/** Decides defeat first (a breach, then a signal at its `defeatAt`), then the level's win condition. */
export function createOutcome(world: World, allSpawned: () => boolean): System {
  const { level, state } = world;
  const win = level.win ?? { type: 'clear' };

  return (events) => {
    const breached = state.enemies.some((enemy) => enemy.pos <= 0);
    const overrun = world.signalDefs.find(([name, def]) => def.defeatAt !== undefined && world.signalFraction(name) >= def.defeatAt);
    if (breached || overrun) {
      const cause: DefeatCause = breached ? { type: 'breach' } : { type: 'signal', signal: overrun![0] };
      state.status = 'lost';
      state.defeat = cause;
      events.push({ type: 'lost', cause });
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
