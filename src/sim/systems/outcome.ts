import { secondsToTicks } from '../time';
import type { DefeatCause } from '../types';
import type { System, World } from '../world';

/**
 * Decides defeat first (a breach, then a signal at its `defeatAt`), then the level's win condition.
 * A clear level is not won while a unit still carries a status that will burst into new enemies;
 * an antigen level is won as soon as its antigen reaches the lymph node, whatever is left on the board.
 */
export function createOutcome(
  world: World,
  allSpawned: () => boolean,
  pendingBurst: () => boolean = () => false,
): System {
  const { level, state } = world;
  const win = level.win ?? { type: 'clear' };
  let bossSeen = false;

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
    const bossAlive = win.type === 'boss' && state.enemies.some((enemy) => enemy.defId === win.enemy);
    bossSeen ||= bossAlive;
    const won =
      win.type === 'survive'
        ? state.tick >= secondsToTicks(win.seconds)
        : win.type === 'antigen'
          ? state.antigenDelivered >= win.count
          : win.type === 'boss'
            ? bossSeen && !bossAlive && state.enemies.length === 0 && !pendingBurst()
            : allSpawned() && state.enemies.length === 0 && !pendingBurst();
    if (!won) return;
    state.status = 'won';
    events.push({ type: 'won' });
  };
}
