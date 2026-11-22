import { TICKS_PER_SECOND, secondsToTicks } from '../time';
import type { BossPhase, EnemyDef, EnemyState } from '../types';
import { CELL, engagedCol, type System, type World } from '../world';

/**
 * Boss behaviour, all declared on the enemy: shedding random enemies while alive, a toxin aura and a
 * shield that start once its health falls to their thresholds (each phase is reported once).
 */
export function createBoss(world: World): System {
  const { state, level } = world;
  const rows = level.grid.rows;

  const reach = (def: EnemyDef, enemy: EnemyState, phase: BossPhase, from: number, events: Parameters<System>[0]): boolean => {
    if (enemy.hp > from * def.hp) return enemy.phases?.includes(phase) ?? false;
    if (enemy.phases?.includes(phase)) return true;
    (enemy.phases ??= []).push(phase);
    events.push({ type: 'boss_phase', uid: enemy.uid, phase });
    if (phase === 'shield') enemy.shield = def.shield!.hp;
    return true;
  };

  return (events) => {
    const born: EnemyState[] = [];
    for (const enemy of state.enemies) {
      const def = world.enemyDef(enemy.defId);
      if (enemy.hp <= 0) continue;

      (def.sheds ?? []).forEach((stream, i) => {
        const every = secondsToTicks(stream.every);
        enemy.nextShed ??= [];
        enemy.nextShed[i] ??= state.tick + every;
        if (state.tick < enemy.nextShed[i]!) return;
        enemy.nextShed[i]! += every;
        const total = stream.pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
        let roll = world.random() * total;
        const pick = stream.pool.find((entry) => (roll -= Math.max(0, entry.weight)) < 0) ?? stream.pool[stream.pool.length - 1]!;
        const shedDef = world.enemyDef(pick.enemy);
        const lane = Math.floor(world.random() * rows);
        const child: EnemyState = {
          uid: state.nextUid++,
          defId: shedDef.id,
          lane,
          pos: stream.from === 'self' ? enemy.pos : level.grid.cols * CELL,
          hp: shedDef.hp,
          attackReadyAt: 0,
          switches: 0,
        };
        born.push(child);
        events.push({ type: 'enemy_spawned', uid: child.uid, defId: child.defId, lane });
      });

      if (def.aura && reach(def, enemy, 'aura', def.aura.from, events)) {
        const { radius, requires, damagePerSecond } = def.aura;
        const covered = world.rowsOf(enemy);
        const col = engagedCol(enemy.pos);
        for (const unit of state.units) {
          const tags = world.unitDef(unit.defId).tags ?? [];
          if (!requires.every((tag) => tags.includes(tag))) continue;
          const near = Math.abs(unit.col - col) <= radius && covered.some((row) => Math.abs(unit.row - row) <= radius);
          if (near) unit.hp -= damagePerSecond / TICKS_PER_SECOND;
        }
      }

      if (def.shield) reach(def, enemy, 'shield', def.shield.from, events);
    }
    state.enemies.push(...born);
    world.removeDeadUnits(events);
  };
}
