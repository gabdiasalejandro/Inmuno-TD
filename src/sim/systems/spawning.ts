import { secondsToTicks } from '../time';
import type { EnemyState } from '../types';
import { CELL, assertLaneInGrid, type System, type World } from '../world';

/** Opens wounded lanes and brings enemies in on the schedule the level's waves describe. */
export function createSpawning(world: World): { openWounds: System; spawnDue: System; allSpawned(): boolean } {
  const { level, state } = world;

  const wounds = (level.wounds ?? []).map((wound) => {
    assertLaneInGrid(level, wound.lane, 'wound lane');
    return { tick: secondsToTicks(wound.at), lane: wound.lane };
  });

  const schedule = level.waves
    .flatMap((wave) => {
      assertLaneInGrid(level, wave.lane, 'lane');
      return Array.from({ length: wave.count }, (_, i) => ({
        tick: secondsToTicks(wave.at + i * wave.gap),
        enemy: wave.enemy,
        lane: wave.lane,
      }));
    })
    // Array.prototype.sort is stable, so same-tick spawns keep their order in the level file.
    .sort((a, b) => a.tick - b.tick);

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
        };
        state.enemies.push(enemy);
        state.nextSpawn++;
        events.push({ type: 'enemy_spawned', uid: enemy.uid, defId: enemy.defId, lane: enemy.lane });
      }
    },

    // A level without waves is a sandbox: it never counts as fully spawned.
    allSpawned: () => schedule.length > 0 && state.nextSpawn >= schedule.length,
  };
}
