import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type Sim, type SimEvent } from '../../src/sim';
import { engagedCol } from '../../src/sim/world';
import { holdLanes, together, type Bot } from './bots';

const BOSS = 'staphylococcus_aureus_colonia';
const colony = (sim: Sim) => sim.state.enemies.find((enemy) => enemy.defId === BOSS);

const defence = holdLanes('macrofago', 3);
/** Once the colony stands in its column, a macrophage right in front of it in each lane it covers. */
const siege: Bot = (sim) => {
  const boss = colony(sim);
  if (!boss || engagedCol(boss.pos) > 7) return;
  for (const lane of [boss.lane - 1, boss.lane, boss.lane + 1]) {
    if (sim.state.units.some((unit) => unit.row === lane && unit.col === 6)) continue;
    if (sim.state.energy >= 100) sim.placeUnit('macrofago', lane, 6);
  }
};
const carefulRelease: Bot = (sim) => sim.setReleasing(sim.signal('inflamacion') < 0.3);
/** The complement on the colony whenever it is ready and inflammation can take it. */
const complement: Bot = (sim) => {
  const boss = colony(sim);
  if (boss && sim.signal('inflamacion') <= 0.55) sim.playPower('complemento', boss.lane, engagedCol(boss.pos));
};

function play(bot: Bot, seconds = 600) {
  const level = levels['1-8']!;
  const sim = createSim(level, content, 1);
  const events: SimEvent[] = [];
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(seconds)) {
    bot(sim, level);
    events.push(...sim.step());
  }
  return { sim, events, seconds: sim.state.tick / 20 };
}

describe('level 1-8 balance', () => {
  it('is won by laying siege to the colony with macrophages and marking it with the complement, in 2 to 4 minutes', () => {
    const { sim, events, seconds } = play(together(defence, siege, carefulRelease, complement));
    expect(sim.state.status).toBe('won');
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(240);
    expect(events.filter((e) => e.type === 'boss_phase').map((e) => (e as { phase: string }).phase)).toEqual(['aura', 'shield']);
  });

  it('takes clearly longer without the complement: C3b multiplies the damage on the colony and its wall', () => {
    const withIt = play(together(defence, siege, carefulRelease, complement));
    const without = play(together(defence, siege, carefulRelease));
    expect(without.sim.state.status).toBe('won');
    expect(without.seconds).toBeGreaterThan(withIt.seconds + 40);
  });

  it('is lost by a defence that only waits: the colony holds its ground and keeps shedding bacteria', () => {
    const { sim } = play(together(defence, carefulRelease));
    expect(sim.state.status).toBe('lost');
  });

  it('kills a neutrophil next to the colony within two seconds once the leukocidins are out', () => {
    const level = levels['1-8']!;
    const sim = createSim(level, content, 1);
    while (!colony(sim) || engagedCol(colony(sim)!.pos) > 7) {
      defence(sim, level);
      sim.step();
    }
    const boss = colony(sim)!;
    boss.hp = 0.6 * content.enemies.find((e) => e.id === BOSS)!.hp;
    sim.state.energy = 1000;
    expect(sim.placeUnit('neutrofilo', boss.lane + 1, 6)).toEqual({ ok: true });
    const events: SimEvent[] = [];
    for (let i = 0; i < secondsToTicks(2); i++) events.push(...sim.step());
    expect(events.some((e) => e.type === 'unit_died' && e.defId === 'neutrofilo' && e.cause === 'killed')).toBe(true);
  });

  it('shrugs off the membrane attack: the colony is gram-positive', () => {
    const { events } = play(together(defence, siege, carefulRelease, complement), 200);
    const macs = events.filter((e) => e.type === 'power_step' && e.kind === 'attack');
    expect(macs.length).toBeGreaterThan(0);
    expect(macs.every((e) => (e as { enemies: number[] }).enemies.length === 0)).toBe(true);
  });

  it('is a boss level: the colony is the win condition, stands still and sheds S. aureus', () => {
    const level = levels['1-8']!;
    expect(level.win).toEqual({ type: 'boss', enemy: BOSS });
    const def = content.enemies.find((e) => e.id === BOSS)!;
    expect(def.anchor).toBeDefined();
    expect(def.sheds?.enemy).toBe('staphylococcus_aureus');
  });
});
