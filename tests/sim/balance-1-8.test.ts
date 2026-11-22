import { describe, expect, it } from 'vitest';
import { content, levels } from '../../src/data';
import { createSim, secondsToTicks, type Sim, type SimEvent } from '../../src/sim';
import { engagedCol } from '../../src/sim/world';
import { holdLanes, together, type Bot } from './bots';

const BOSS = 'staphylococcus_aureus_colonia';
const SEEDS = [1, 2, 3, 4, 5];
const colony = (sim: Sim) => sim.state.enemies.find((enemy) => enemy.defId === BOSS);
const occupied = (sim: Sim, row: number, col: number) => sim.state.units.some((unit) => unit.row === row && unit.col === col);

const defence = holdLanes('macrofago', 3);
/** An epithelium in a lane with bacteria and neither macrophage nor wall yet (macrophages take 12 s to redeploy). */
const plug: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    if (sim.state.units.some((u) => u.row === lane && (u.defId === 'macrofago' || u.defId === 'epitelio'))) continue;
    if (sim.state.enemies.some((e) => e.lane === lane && e.defId !== BOSS)) sim.placeUnit('epitelio', lane, 2);
  }
};
/** Once the colony stands in its column, a macrophage right in front of it in each lane it covers. */
const siege: Bot = (sim) => {
  const boss = colony(sim);
  if (!boss || engagedCol(boss.pos) > 6) return;
  for (const lane of [boss.lane - 1, boss.lane, boss.lane + 1]) {
    if (!occupied(sim, lane, 5) && sim.state.energy >= 100) sim.placeUnit('macrofago', lane, 5);
  }
};
/** Neutrophils behind a lane's macrophage when bacteria come close, kept out of the colony's toxins. */
const neutrophils: Bot = (sim) => {
  for (const lane of sim.state.openLanes) {
    const near = sim.state.enemies.filter((e) => e.lane === lane && e.defId !== BOSS).map((e) => engagedCol(e.pos));
    const front = Math.min(99, ...near);
    if (front > 5 || sim.state.energy < 150 || !sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) continue;
    const col = Math.max(2, Math.min(4, front - 1));
    if (Math.abs(lane - 2) <= 1 && col >= 4) continue;
    if (!occupied(sim, lane, col)) sim.placeUnit('neutrofilo', lane, col);
  }
};
/** An NK cell next to any infected cell. */
const nk: Bot = (sim) => {
  for (const cell of sim.state.units) {
    if ((cell.statuses.infectada ?? 0) <= sim.state.tick) continue;
    for (const [dr, dc] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const row = cell.row + dr;
      const col = cell.col + dc;
      if (row < 0 || row > 4 || col < 0 || col > 8 || occupied(sim, row, col)) continue;
      if (sim.placeUnit('nk', row, col).ok) return;
    }
  }
};
const carefulRelease: Bot = (sim) => sim.setReleasing(sim.signal('inflamacion') < 0.3);
/** The complement on an unmarked capsulated bacterium, or on the colony once it stands, while inflammation allows. */
const complement: Bot = (sim) => {
  if (sim.signal('inflamacion') > 0.4) return;
  const capsule = sim.state.enemies.find((e) => e.defId === 'bacteria_capsulada' && !e.statuses?.opsonizado && e.pos < 6000);
  const boss = colony(sim);
  const target = capsule ?? (boss && engagedCol(boss.pos) <= 6 ? boss : undefined);
  if (target) sim.playPower('complemento', target.lane, engagedCol(target.pos));
};
const withoutComplement = together(defence, plug, nk, siege, neutrophils, carefulRelease);
const full = together(withoutComplement, complement);

function play(bot: Bot, seed = 1, seconds = 600) {
  const level = levels['1-8']!;
  const sim = createSim(level, content, seed);
  const events: SimEvent[] = [];
  while (sim.state.status === 'playing' && sim.state.tick < secondsToTicks(seconds)) {
    bot(sim, level);
    events.push(...sim.step());
  }
  return { sim, events, seconds: sim.state.tick / 20 };
}

describe('level 1-8 balance', () => {
  it.each(SEEDS)('is won with every tool of world 1, in 2 to 4 minutes (seed %i)', (seed) => {
    const { sim, events, seconds } = play(full, seed);
    expect(sim.state.status).toBe('won');
    expect(seconds).toBeGreaterThan(120);
    expect(seconds).toBeLessThan(240);
    expect(events.filter((e) => e.type === 'boss_phase').map((e) => (e as { phase: string }).phase)).toEqual(['aura', 'shield']);
  });

  it('ends with a macrophage engulfing the weakened colony, and is won only once the board is clear', () => {
    const { sim, events } = play(full);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const end = events.findIndex((e) => e.type === 'unit_attacked' && e.target === boss.uid && e.kind === 'engulf');
    const won = events.findIndex((e) => e.type === 'won');
    expect(end).toBeGreaterThan(-1);
    expect(won).toBeGreaterThan(end);
    expect(events.slice(end, won).some((e) => e.type === 'enemy_died' && e.uid !== boss.uid)).toBe(true);
    expect(sim.state.enemies).toHaveLength(0);
  });

  it('strikes the colony with quick, lighter blows rather than bites', () => {
    const { events } = play(full);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const blows = events.filter((e) => e.type === 'unit_attacked' && e.target === boss.uid && e.kind === 'strike');
    expect(blows.length).toBeGreaterThan(20);
  });

  it.each(SEEDS)('is lost without the complement: capsulated bacteria slip past the phagocytes (seed %i)', (seed) => {
    const { sim } = play(withoutComplement, seed);
    expect(sim.state.status).toBe('lost');
  });

  it('is lost by a defence that only waits: the colony holds its ground and keeps shedding bacteria', () => {
    const { sim } = play(together(defence, plug, carefulRelease));
    expect(sim.state.status).toBe('lost');
  });

  it('sheds a random mix that includes capsulated bacteria and viruses', () => {
    const { events } = play(full, 1, 200);
    const shed = new Set(events.flatMap((e) => (e.type === 'enemy_spawned' ? [e.defId] : [])));
    expect(shed).toContain('bacteria_capsulada');
    expect(shed).toContain('virus');
  });

  it('kills a neutrophil next to the colony within two seconds once the leukocidins are out', () => {
    const level = levels['1-8']!;
    const sim = createSim(level, content, 1);
    while (!colony(sim) || engagedCol(colony(sim)!.pos) > 6) {
      defence(sim, level);
      sim.step();
    }
    const boss = colony(sim)!;
    boss.hp = 0.6 * content.enemies.find((e) => e.id === BOSS)!.hp;
    sim.state.energy = 1000;
    expect(sim.placeUnit('neutrofilo', boss.lane + 1, 5)).toEqual({ ok: true });
    const events: SimEvent[] = [];
    for (let i = 0; i < secondsToTicks(2); i++) events.push(...sim.step());
    expect(events.some((e) => e.type === 'unit_died' && e.defId === 'neutrofilo' && e.cause === 'killed')).toBe(true);
  });

  it('shrugs off the membrane attack: the colony is gram-positive', () => {
    const { events } = play(full, 1, 200);
    const boss = events.find((e) => e.type === 'enemy_spawned' && e.defId === BOSS) as { uid: number };
    const macs = events.filter((e) => e.type === 'power_step' && e.kind === 'attack');
    expect(macs.length).toBeGreaterThan(0);
    expect(macs.some((e) => (e as { enemies: number[] }).enemies.includes(boss.uid))).toBe(false);
  });

  it('is a boss level: the colony is the win condition, stands still and sheds a weighted mix', () => {
    const level = levels['1-8']!;
    expect(level.win).toEqual({ type: 'boss', enemy: BOSS });
    const def = content.enemies.find((e) => e.id === BOSS)!;
    expect(def.anchor).toBeDefined();
    expect(def.engulfBelow).toBeDefined();
    expect(def.sheds?.pool.map((entry) => entry.enemy)).toEqual(['staphylococcus_aureus', 'bacteria_capsulada', 'virus']);
  });
});
