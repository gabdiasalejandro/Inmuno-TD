import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content, levels, tutorials, type TutorialStep } from '../../src/data';
import { countEnemies, createTutorial, FAST_SCALE } from '../../src/game/tutorial';
import { engagedCol } from '../../src/sim/world';
import { t } from '../../src/i18n';
import { createSim, secondsToTicks, type Sim, type SimEvent } from '../../src/sim';

const DIR = join(import.meta.dirname, '..', '..', 'src', 'data', 'tutorials');
const files = readdirSync(DIR).filter((name) => name.endsWith('.json'));
const unitIds = new Set(content.units.map((u) => u.id));

describe('tutorial 1-3', () => {
  it('places the macrophage at row 2, col 6', () => {
    expect(tutorials['1-3']!.steps[0]!.advance).toMatchObject({ type: 'place', unit: 'macrofago', row: 2, col: 6 });
  });
});

describe('tutorial registry', () => {
  it('registers every tutorial file under the level id in its file name, with no manual list', () => {
    expect(Object.keys(tutorials).sort()).toEqual(files.map((name) => name.replace(/\.json$/, '')).sort());
  });

  it.each(Object.keys(tutorials))('tutorial %s only references what its level has', (id) => {
    const level = levels[id];
    expect(level, `level ${id} exists`).toBeDefined();
    const steps = tutorials[id]!.steps;
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(t(step.text), `text ${step.text}`).not.toBe(step.text);
      if (step.advance.type === 'place') {
        expect(level!.deck).toContain(step.advance.unit);
        expect(step.advance.row ?? 0).toBeLessThan(level!.grid.rows);
        expect(step.advance.col ?? 0).toBeLessThan(level!.grid.cols);
      }
      if (step.target?.type === 'card' || step.target?.type === 'unit') expect(unitIds.has(step.target.unit)).toBe(true);
    }
  });
});

/** Plays the sim like a player who follows the tutorial's steps, returning how many it completed. */
function followTutorial(levelId: string, steps: TutorialStep[], maxSeconds: number): { done: number; sim: Sim; frames: number; frameOfStep: number[] } {
  const level = levels[levelId]!;
  const sim = createSim(level, content, 1);
  const tutorial = createTutorial(steps);
  const limit = secondsToTicks(maxSeconds);
  let heldTicks = 0;
  let frames = 0;
  let slowCarry = 0;
  const frameOfStep: number[] = [];
  const seen = new Set<string>();
  const record = (events: SimEvent[]) => events.forEach((event) => seen.add(event.type));
  while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < limit) {
    tutorial.observe({
      stored: level.signals?.reduce((sum, name) => sum + sim.stored(name), 0) ?? 0,
      seen,
      enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)),
    });
    const step = tutorial.step;
    let holding = false;
    if (step && tutorial.active) {
      const { advance } = step;
      if (advance.type === 'place' && sim.placeUnit(advance.unit, advance.row ?? 0, advance.col ?? 0).ok) {
        tutorial.perform({ type: 'place', unit: advance.unit, row: advance.row ?? 0, col: advance.col ?? 0 });
      } else if (advance.type === 'hold') {
        holding = true;
        tutorial.perform({ type: 'hold', seconds: heldTicks / secondsToTicks(1) });
      } else if (advance.type === 'tap') {
        tutorial.perform({ type: 'tap' });
      } else if (advance.type === 'power') {
        // A player plays the power on the first capsulated bacterium, where it stands.
        const target = sim.state.enemies.find((enemy) => enemy.defId === 'bacteria_capsulada');
        const row = target?.lane ?? 2;
        const col = target ? engagedCol(target.pos) : 4;
        if (sim.playPower(advance.power, row, col).ok) tutorial.perform({ type: 'power', power: advance.power, row, col });
      }
    }
    sim.setReleasing(holding);
    heldTicks = holding ? heldTicks + 1 : 0;
    // A paused step freezes the clock, as in the game; a fast one runs several ticks per frame.
    for (let i = 0; i < Math.floor(tutorial.timeScale) && sim.state.status === 'playing'; i++) record(sim.step());
    if (tutorial.timeScale > 0 && tutorial.timeScale < 1) {
      slowCarry += tutorial.timeScale;
      if (slowCarry >= 1) {
        slowCarry -= 1;
        record(sim.step());
      }
    }
    frames++;
    while (frameOfStep.length < tutorial.index + (tutorial.active ? 1 : 0)) frameOfStep.push(frames);
  }
  return { done: tutorial.index, sim, frames, frameOfStep };
}

describe('tutorial 1-3', () => {
  it('can be followed to the end with the real rules, well before the level ends', () => {
    const steps = tutorials['1-3']!.steps;
    const { done, sim } = followTutorial('1-3', steps, 90);
    expect(done).toBe(steps.length);
    expect(sim.state.status).toBe('playing');
    // Holding the button really fed the meter.
    expect(sim.state.released.citocinas).toBeGreaterThan(0);
  });

  it('fast-forwards the wait for bacteria: the release step shows sooner than at normal speed', () => {
    const steps = tutorials['1-3']!.steps;
    expect(steps.some((step) => step.waitTime === 'fast')).toBe(true);
    const normal = steps.map((step) => ({ ...step, waitTime: undefined }));
    const fast = followTutorial('1-3', steps, 90);
    const slow = followTutorial('1-3', normal, 90);
    // frameOfStep[1] is the frame where step 2 (the hold) first showed.
    const fastAt = fast.frameOfStep[1]! / secondsToTicks(1);
    const normalAt = slow.frameOfStep[1]! / secondsToTicks(1);
    expect(fastAt).toBeLessThan(normalAt - 3);
    expect(FAST_SCALE).toBe(2);
  });

  it('teaches the release button with a hold step', () => {
    expect(tutorials['1-3']!.steps.some((step) => step.advance.type === 'hold')).toBe(true);
  });

  it('has between 3 and 5 steps', () => {
    expect(tutorials['1-3']!.steps.length).toBeGreaterThanOrEqual(3);
    expect(tutorials['1-3']!.steps.length).toBeLessThanOrEqual(5);
  });
});

describe('tutorial 1-6', () => {
  it('is completed by a player who plays the complement on the capsulated bacteria', () => {
    const { done } = followTutorial('1-6', tutorials['1-6']!.steps, 120);
    expect(done).toBe(tutorials['1-6']!.steps.length);
  });

  it('teaches the power with the marrow, not with a card', () => {
    const steps = tutorials['1-6']!.steps;
    expect(steps[0]!.target).toEqual({ type: 'power', power: 'complemento' });
    expect(steps.some((step) => step.advance.type === 'power')).toBe(true);
  });

  it('asks for the complement once the whole first group of capsulated bacteria is out, not at the first one', () => {
    const play = tutorials['1-6']!.steps.find((step) => step.advance.type === 'power')!;
    const group = levels['1-6']!.waves.find((wave) => wave.enemy === 'bacteria_capsulada')!;
    expect(play.waitFor).toEqual({ type: 'enemy', enemy: 'bacteria_capsulada', atLeast: group.count });
  });
});

describe('tutorial 1-4', () => {
  /**
   * A player who keeps a macrophage behind an epithelium in every open lane, with gaps, and
   * releases with moderation: the inflammation rises and an S. pyogenes goes around a wall.
   */
  function playWatching(maxSeconds: number) {
    const level = levels['1-4']!;
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(tutorials['1-4']!.steps);
    const seen = new Set<string>();
    const shown: number[] = [];
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(maxSeconds)) {
      tutorial.observe({ stored: 0, signals: { inflamacion: sim.signal('inflamacion') }, seen, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)) });
      if (tutorial.active) {
        shown.push(tutorial.index);
        tutorial.perform({ type: 'tap' });
        continue;
      }
      for (const lane of sim.state.openLanes) {
        if (!sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) sim.placeUnit('macrofago', lane, 3);
        else if (lane % 2 === 0) sim.placeUnit('epitelio', lane, 6);
      }
      sim.setReleasing(sim.signal('citocinas') < 0.5 && sim.signal('inflamacion') < 0.35);
      for (const event of sim.step()) seen.add(event.type);
    }
    return { shown, finished: tutorial.finished };
  }

  it('introduces the inflammation gauge, its tiers and the first S. pyogenes on the board, in that order', () => {
    const steps = tutorials['1-4']!.steps;
    expect(steps.map((step) => step.text)).toEqual(['tutorial.1-4.inflammation', 'tutorial.1-4.tiers', 'tutorial.1-4.spread']);
    expect(steps[0]!.waitFor).toEqual({ type: 'signal', signal: 'inflamacion' });
    expect(steps[2]!.waitFor).toEqual({ type: 'enemy', enemy: 'streptococcus_pyogenes' });
    expect(steps[2]!.target).toEqual({ type: 'enemy', enemy: 'streptococcus_pyogenes' });
  });

  it('can be followed to the end with the real rules', () => {
    const { shown, finished } = playWatching(240);
    expect(finished).toBe(true);
    expect(shown).toEqual([0, 1, 2]);
  });

  it('states the level objectives as exam questions that exist in the translations', () => {
    const objectives = levels['1-4']!.objectives ?? [];
    expect(objectives).toHaveLength(2);
    for (const key of objectives) {
      expect(t(key)).not.toBe(key);
      expect(t(key).endsWith('?')).toBe(true);
    }
  });
});

describe('tutorial 1-5', () => {
  /** A player who keeps a macrophage behind an epithelium in every open lane and follows the steps. */
  function playFollowing(maxSeconds: number) {
    const level = levels['1-5']!;
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(tutorials['1-5']!.steps);
    const shown: number[] = [];
    let nkPlaced = false;
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(maxSeconds)) {
      const tick = sim.state.tick;
      const statuses = new Set(sim.state.units.flatMap((u) => Object.keys(u.statuses).filter((name) => (u.statuses[name] ?? 0) > tick)));
      tutorial.observe({ stored: 0, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)), statuses });
      const step = tutorial.step;
      if (tutorial.active && step) {
        if (shown[shown.length - 1] !== tutorial.index) shown.push(tutorial.index);
        if (step.advance.type === 'tap') {
          tutorial.perform({ type: 'tap' });
          continue;
        }
        const cell = sim.state.units.find((u) => (u.statuses.infectada ?? 0) > tick) ?? sim.state.units[0]!;
        for (const [row, col] of [[cell.row, cell.col - 1], [cell.row - 1, cell.col], [cell.row + 1, cell.col], [cell.row, cell.col + 1]] as const) {
          if (row < 0 || row >= level.grid.rows || col < 0) continue;
          if (sim.placeUnit('nk', row, col).ok) {
            nkPlaced = true;
            tutorial.perform({ type: 'place', unit: 'nk', row, col });
            break;
          }
        }
      } else {
        for (const lane of sim.state.openLanes) {
          if (!sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) sim.placeUnit('macrofago', lane, 3);
          else if (!sim.state.units.some((u) => u.row === lane && u.defId === 'epitelio')) sim.placeUnit('epitelio', lane, 4);
        }
      }
      // The scene slows the clock on a slow step; one step per frame is enough for this check.
      if (tutorial.timeScale > 0) sim.step();
    }
    return { shown, finished: tutorial.finished, nkPlaced };
  }

  it('presents the virus, the first infected cell, the interferon shield and the NK cell, in that order', () => {
    const steps = tutorials['1-5']!.steps;
    expect(steps.map((step) => step.text)).toEqual(['tutorial.1-5.virus', 'tutorial.1-5.infected', 'tutorial.1-5.interferon', 'tutorial.1-5.nk']);
    expect(steps[1]!.target).toEqual({ type: 'status', status: 'infectada' });
    expect(steps[3]!.advance).toEqual({ type: 'place', unit: 'nk' });
  });

  it('can be followed to the end with the real rules', () => {
    const { shown, finished, nkPlaced } = playFollowing(240);
    expect(finished).toBe(true);
    expect(shown).toEqual([0, 1, 2, 3]);
    expect(nkPlaced).toBe(true);
  });

  it('states the level objectives as exam questions that exist in the translations', () => {
    const objectives = levels['1-5']!.objectives ?? [];
    expect(objectives).toHaveLength(2);
    for (const key of objectives) {
      expect(t(key)).not.toBe(key);
      expect(t(key).endsWith('?')).toBe(true);
    }
  });
});

describe('tutorial 1-7', () => {
  /** A player with a macrophage in every lane who follows the steps, placing the dendritic cell in front of one. */
  function playFollowing(maxSeconds: number) {
    const level = levels['1-7']!;
    const sim = createSim(level, content, 1);
    const tutorial = createTutorial(tutorials['1-7']!.steps);
    const seen = new Set<string>();
    const shown: number[] = [];
    while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < secondsToTicks(maxSeconds)) {
      tutorial.observe({ stored: 0, seen, enemies: countEnemies(sim.state.enemies.map((enemy) => enemy.defId)) });
      const step = tutorial.step;
      if (step && tutorial.active) {
        if (!shown.includes(tutorial.index)) shown.push(tutorial.index);
        if (step.advance.type === 'tap') {
          tutorial.perform({ type: 'tap' });
          continue;
        }
        const lane = sim.state.enemies[0]?.lane ?? 2;
        if (sim.placeUnit('dendritica', lane, 4).ok) tutorial.perform({ type: 'place', unit: 'dendritica', row: lane, col: 4 });
      } else {
        for (const lane of sim.state.openLanes) {
          if (!sim.state.units.some((u) => u.row === lane && u.defId === 'macrofago')) sim.placeUnit('macrofago', lane, 3);
        }
      }
      for (const event of sim.step()) seen.add(event.type);
    }
    return { shown, finished: tutorial.finished, seconds: sim.state.tick / 20 };
  }

  it('can be followed to the end with the real rules, during the first encounters', () => {
    const { shown, finished, seconds } = playFollowing(120);
    expect(finished).toBe(true);
    expect(shown).toEqual([0, 1, 2, 3]);
    expect(seconds).toBeLessThan(120);
  });

  it('asks for the dendritic cell when the first bacteria arrive, not before', () => {
    const steps = tutorials['1-7']!.steps;
    expect(steps[0]!.waitFor).toEqual({ type: 'enemy', enemy: 'streptococcus_pyogenes' });
    expect(steps[0]!.advance).toEqual({ type: 'place', unit: 'dendritica' });
  });

  it('states the level objectives as exam questions that exist in the translations', () => {
    const objectives = levels['1-7']!.objectives ?? [];
    expect(objectives).toHaveLength(2);
    for (const key of objectives) {
      expect(t(key)).not.toBe(key);
      expect(t(key).endsWith('?')).toBe(true);
    }
  });
});

describe('tutorial 1-8', () => {
  it('introduces the colony, then each of its phases as it reaches them', () => {
    const steps = tutorials['1-8']!.steps;
    expect(steps.map((step) => step.waitFor)).toEqual([
      { type: 'enemy', enemy: 'staphylococcus_aureus_colonia' },
      { type: 'boss_phase', phase: 'aura' },
      { type: 'boss_phase', phase: 'shield' },
    ]);
  });

  it('states the level objectives as exam questions that exist in the translations', () => {
    const objectives = levels['1-8']!.objectives ?? [];
    expect(objectives).toHaveLength(2);
    for (const key of objectives) {
      expect(t(key)).not.toBe(key);
      expect(t(key).endsWith('?')).toBe(true);
    }
  });
});
