import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content, levels, tutorials, type TutorialStep } from '../../src/data';
import { createTutorial, FAST_SCALE } from '../../src/game/tutorial';
import { t } from '../../src/i18n';
import { createSim, secondsToTicks, type Sim } from '../../src/sim';

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
  while (!tutorial.finished && sim.state.status === 'playing' && sim.state.tick < limit) {
    tutorial.observe({ stored: level.signals?.reduce((sum, name) => sum + sim.stored(name), 0) ?? 0 });
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
      }
    }
    sim.setReleasing(holding);
    heldTicks = holding ? heldTicks + 1 : 0;
    // A paused step freezes the clock, as in the game; a fast one runs several ticks per frame.
    for (let i = 0; i < Math.floor(tutorial.timeScale) && sim.state.status === 'playing'; i++) sim.step();
    if (tutorial.timeScale > 0 && tutorial.timeScale < 1) {
      slowCarry += tutorial.timeScale;
      if (slowCarry >= 1) {
        slowCarry -= 1;
        sim.step();
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
      tutorial.observe({ stored: 0, signals: { inflamacion: sim.signal('inflamacion') }, seen, enemies: new Set(sim.state.enemies.map((enemy) => enemy.defId)) });
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
