import { secondsToTicks } from '../time';
import type { EnemyState } from '../types';
import { CELL, assertLaneInGrid, type System, type World } from '../world';

/**
 * Opens wounded lanes and brings enemies in on the schedule the level's waves describe. With
 * `returns`, the later waves come again while `short()` says the win still needs antigen.
 */
export function createSpawning(
  world: World,
  short: () => boolean = () => false,
): { openWounds: System; spawnDue: System; comeBack: System; allSpawned(): boolean } {
  const { level, state } = world;

  const wounds = (level.wounds ?? []).map((wound) => {
    assertLaneInGrid(level, wound.lane, 'wound lane');
    return { tick: secondsToTicks(wound.at), lane: wound.lane };
  });

  const scheduleOf = (waves: typeof level.waves, offset: number) =>
    waves
      .flatMap((wave) => {
        assertLaneInGrid(level, wave.lane, 'lane');
        return Array.from({ length: wave.count }, (_, i) => ({
          tick: offset + secondsToTicks(wave.at + i * wave.gap),
          enemy: wave.enemy,
          lane: wave.lane,
        }));
      })
      // Array.prototype.sort is stable, so same-tick spawns keep their order in the level file.
      .sort((a, b) => a.tick - b.tick);
  const schedule = scheduleOf(level.waves, 0);

  const returning = level.returns && level.waves.filter((wave) => wave.at >= level.returns!.from);
  if (level.returns && (level.win?.type !== 'antigen' || returning!.length === 0)) {
    throw new Error(`Level ${level.id}: returns needs an antigen win and waves at or after ${level.returns.from} s`);
  }
  const allSpawned = (): boolean => schedule.length > 0 && state.nextSpawn >= schedule.length;

  return {
    openWounds(events) {
      for (const wound of wounds) {
        if (wound.tick > state.tick || state.openLanes.includes(wound.lane)) continue;
        state.openLanes.push(wound.lane);
        events.push({ type: 'wound_opened', lane: wound.lane });
      }
    },

    spawnDue(events) {
      for (let next = schedule[state.nextSpawn]; next && next.tick <= state.tick; next = schedule[state.nextSpawn]) {
        const def = world.enemyDef(next.enemy);
        const enemy: EnemyState = {
          uid: state.nextUid++,
          defId: def.id,
          lane: next.lane,
          pos: level.grid.cols * CELL,
          hp: def.hp,
          attackReadyAt: 0,
          switches: 0,
        };
        state.enemies.push(enemy);
        state.nextSpawn++;
        events.push({ type: 'enemy_spawned', uid: enemy.uid, defId: enemy.defId, lane: enemy.lane });
      }
    },

    comeBack(events) {
      if (!level.returns || !allSpawned() || state.enemies.length > 0 || !short()) return;
      const offset = state.tick + secondsToTicks(level.returns.after) - secondsToTicks(level.returns.from);
      schedule.push(...scheduleOf(returning!, offset));
      state.returns++;
      events.push({ type: 'pathogen_returned', count: state.returns });
    },

    // A level without waves is a sandbox: it never counts as fully spawned.
    allSpawned,
  };
}
