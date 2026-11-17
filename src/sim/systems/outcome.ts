import { secondsToTicks } from '../time';
import type { DefeatCause } from '../types';
import type { System, World } from '../world';

/**
 * Decides defeat first (a breach, then a signal at its `defeatAt`), then the level's win condition.
 * A clear level is not won while a unit still carries a status that will burst into new enemies.
 */
export function createOutcome(world: World, allSpawned: () => boolean, pendingBurst: () => boolean = () => false): System {
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
        : allSpawned() && state.enemies.length === 0 && !pendingBurst();
    if (!won) return;
    state.status = 'won';
    events.push({ type: 'won' });
  };
}
