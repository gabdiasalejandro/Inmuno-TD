import { describe, expect, it } from 'vitest';
import type { TutorialStep } from '../../src/data';
import { FAST_SCALE, SLOW_SCALE, createTutorial, needsNext, shouldRunTutorial, targetsFor } from '../../src/game/tutorial';

const none = { stored: 0 };
const some = { stored: 5 };
const plenty = { stored: 20 };

const place: TutorialStep = { text: 'a', advance: { type: 'place', unit: 'macrofago', row: 2, col: 5 } };
const release: TutorialStep = { text: 'b', advance: { type: 'hold', seconds: 1 }, waitFor: { type: 'stored', atLeast: 15 }, time: 'slow' };
const tap: TutorialStep = { text: 'c', advance: { type: 'tap' }, target: { type: 'marrow' } };

describe('createTutorial', () => {
  it('starts on the first step, active, with the game paused', () => {
    const tutorial = createTutorial([place, release, tap]);
    expect(tutorial.finished).toBe(false);
    expect(tutorial.step).toBe(place);
    expect(tutorial.active).toBe(true);
    expect(tutorial.timeScale).toBe(0);
  });

  it('is finished at once when it has no steps', () => {
    expect(createTutorial([]).finished).toBe(true);
  });

  it('only advances on the expected placement', () => {
    const tutorial = createTutorial([place, tap]);
    expect(tutorial.perform({ type: 'place', unit: 'neutrofilo', row: 2, col: 5 })).toBe(false);
    expect(tutorial.perform({ type: 'place', unit: 'macrofago', row: 0, col: 0 })).toBe(false);
    expect(tutorial.index).toBe(0);
    expect(tutorial.perform({ type: 'place', unit: 'macrofago', row: 2, col: 5 })).toBe(true);
    expect(tutorial.step).toBe(tap);
  });

  it('accepts a placement on any cell when the step names none', () => {
    const tutorial = createTutorial([{ text: 'a', advance: { type: 'place', unit: 'epitelio' } }]);
    expect(tutorial.allows({ type: 'place', unit: 'epitelio', row: 4, col: 1 })).toBe(true);
  });

  it('blocks everything but the expected action while a step is locked', () => {
    const tutorial = createTutorial([place]);
    expect(tutorial.allows({ type: 'select', unit: 'macrofago' })).toBe(true);
    expect(tutorial.allows({ type: 'select', unit: 'neutrofilo' })).toBe(false);
    expect(tutorial.allows({ type: 'place', unit: 'macrofago', row: 2, col: 4 })).toBe(false);
    expect(tutorial.allows({ type: 'place', unit: 'macrofago', row: 2, col: 5 })).toBe(true);
    expect(tutorial.allows({ type: 'hold', seconds: 0 })).toBe(false);
    expect(tutorial.allows({ type: 'tap' })).toBe(false);
  });

  it('a selection never advances a step', () => {
    const tutorial = createTutorial([place]);
    expect(tutorial.perform({ type: 'select', unit: 'macrofago' })).toBe(false);
    expect(tutorial.index).toBe(0);
  });

  it('a step with waitFor stays hidden, free and running until the condition holds', () => {
    const tutorial = createTutorial([release]);
    tutorial.observe(none);
    expect(tutorial.active).toBe(false);
    expect(tutorial.timeScale).toBe(1);
    expect(tutorial.allows({ type: 'place', unit: 'neutrofilo', row: 0, col: 0 })).toBe(true);
    tutorial.observe(some);
    expect(tutorial.active).toBe(false);
    tutorial.observe(plenty);
    expect(tutorial.active).toBe(true);
    expect(tutorial.timeScale).toBe(SLOW_SCALE);
  });

  it('a stored wait without a threshold shows on any charge', () => {
    const tutorial = createTutorial([{ text: 'w', advance: { type: 'tap' }, waitFor: { type: 'stored' } }]);
    tutorial.observe(none);
    expect(tutorial.active).toBe(false);
    tutorial.observe(some);
    expect(tutorial.active).toBe(true);
  });

  it('keeps a waited step active once it latched, even if the charge is gone', () => {
    const tutorial = createTutorial([release]);
    tutorial.observe(plenty);
    tutorial.observe(none);
    expect(tutorial.active).toBe(true);
  });

  it('a hidden step whose action the player already did counts as done, so it never waits forever', () => {
    const tutorial = createTutorial([release, tap]);
    tutorial.observe(some);
    expect(tutorial.perform({ type: 'hold', seconds: 0.5 })).toBe(false);
    expect(tutorial.perform({ type: 'hold', seconds: 1 })).toBe(true);
    expect(tutorial.step).toBe(tap);
    expect(tutorial.active).toBe(true);
  });

  it('a hidden step without waitFor does not exist: only waited steps can be done early', () => {
    const tutorial = createTutorial([place, tap]);
    expect(tutorial.perform({ type: 'tap' })).toBe(false);
  });

  it('a hold is allowed at once but only ends the step after the minimum time', () => {
    const tutorial = createTutorial([release]);
    tutorial.observe(plenty);
    expect(tutorial.allows({ type: 'hold', seconds: 0 })).toBe(true);
    expect(tutorial.allows({ type: 'tap' })).toBe(false);
    expect(tutorial.perform({ type: 'hold', seconds: 0.4 })).toBe(false);
    expect(tutorial.perform({ type: 'hold', seconds: 1.2 })).toBe(true);
    expect(tutorial.finished).toBe(true);
  });

  it('a hold without a minimum ends on any press', () => {
    const tutorial = createTutorial([{ text: 'h', advance: { type: 'hold' } }]);
    expect(tutorial.perform({ type: 'hold', seconds: 0 })).toBe(true);
  });

  it('a tap advances a tap step and is ignored elsewhere', () => {
    const tutorial = createTutorial([place, tap]);
    expect(tutorial.perform({ type: 'tap' })).toBe(false);
    tutorial.perform({ type: 'place', unit: 'macrofago', row: 2, col: 5 });
    expect(tutorial.allows({ type: 'tap' })).toBe(true);
    expect(tutorial.perform({ type: 'tap' })).toBe(true);
    expect(tutorial.finished).toBe(true);
    expect(tutorial.step).toBeNull();
    expect(tutorial.timeScale).toBe(1);
  });

  it('a free step allows every action and does not need the expected one to move on', () => {
    const tutorial = createTutorial([{ text: 'f', advance: { type: 'tap' }, input: 'free', time: 'run' }]);
    expect(tutorial.allows({ type: 'place', unit: 'x', row: 0, col: 0 })).toBe(true);
    expect(tutorial.timeScale).toBe(1);
  });

  it('slow steps run at a fraction of the speed', () => {
    const tutorial = createTutorial([{ text: 's', advance: { type: 'tap' }, time: 'slow' }]);
    expect(tutorial.timeScale).toBe(SLOW_SCALE);
    expect(SLOW_SCALE).toBeGreaterThan(0);
    expect(SLOW_SCALE).toBeLessThan(1);
  });

  it('a hidden step with waitTime fast runs the game at FAST_SCALE until it shows', () => {
    const tutorial = createTutorial([{ ...release, waitTime: 'fast' }, tap]);
    tutorial.observe(none);
    expect(FAST_SCALE).toBeGreaterThan(1);
    expect(tutorial.timeScale).toBe(FAST_SCALE);
    tutorial.observe(plenty);
    expect(tutorial.active).toBe(true);
    expect(tutorial.timeScale).toBe(SLOW_SCALE);
  });

  it('without waitTime a hidden step keeps normal speed', () => {
    const plain = createTutorial([release]);
    plain.observe(none);
    expect(plain.timeScale).toBe(1);
    const fast = createTutorial([{ ...release, waitTime: 'fast' }]);
    fast.observe(none);
    expect(fast.timeScale).toBe(FAST_SCALE);
  });

  it('evaluates the next step against the last observation when it becomes current', () => {
    const tutorial = createTutorial([tap, release]);
    tutorial.observe(plenty);
    tutorial.perform({ type: 'tap' });
    expect(tutorial.step).toBe(release);
    expect(tutorial.active).toBe(true);
  });

});

describe('shouldRunTutorial', () => {
  const def = { steps: [tap] };

  it('runs on a level that has one and was not completed', () => {
    expect(shouldRunTutorial(def, false)).toBe(true);
  });

  it('skips it when the level was already completed', () => {
    expect(shouldRunTutorial(def, true)).toBe(false);
  });

  it('skips it when the level has none or an empty one', () => {
    expect(shouldRunTutorial(undefined, false)).toBe(false);
    expect(shouldRunTutorial({ steps: [] }, false)).toBe(false);
  });
});

describe('targetsFor', () => {
  it('highlights the card and the fixed cell at once, the card first (the arrow goes there)', () => {
    expect(targetsFor(place)).toEqual([
      { type: 'card', unit: 'macrofago' },
      { type: 'cell', row: 2, col: 5 },
    ]);
  });

  it('highlights only the card when the placement fixes no cell', () => {
    const free: TutorialStep = { text: 'a', advance: { type: 'place', unit: 'epitelio' } };
    expect(targetsFor(free)).toEqual([{ type: 'card', unit: 'epitelio' }]);
  });

  it('points at the release button for a hold', () => {
    expect(targetsFor(release)).toEqual([{ type: 'release_button' }]);
  });

  it('prefers the target written in the step, and has none for a plain tap', () => {
    expect(targetsFor(tap)).toEqual([{ type: 'marrow' }]);
    expect(targetsFor({ text: 't', advance: { type: 'tap' } })).toEqual([]);
  });
});

describe('needsNext', () => {
  it('is true for a tap step, false for action steps and free-input taps', () => {
    expect(needsNext(tap)).toBe(true);
    expect(needsNext(place)).toBe(false);
    expect(needsNext(release)).toBe(false);
    expect(needsNext({ ...tap, input: 'free' })).toBe(false);
  });
});

describe('waiting for a signal level or an event', () => {
  const quiet = { stored: 0 };

  it('a signal wait shows once that signal reaches its level, and stays shown after', () => {
    const tutorial = createTutorial([{ text: 's', advance: { type: 'tap' }, waitFor: { type: 'signal', signal: 'inflamacion', atLeast: 0.05 } }]);
    tutorial.observe({ ...quiet, signals: { inflamacion: 0.04 } });
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, signals: { inflamacion: 0.05 } });
    expect(tutorial.active).toBe(true);
    tutorial.observe({ ...quiet, signals: { inflamacion: 0 } });
    expect(tutorial.active).toBe(true);
  });

  it('a signal wait without a level shows at any rise, and never without the signal', () => {
    const tutorial = createTutorial([{ text: 's', advance: { type: 'tap' }, waitFor: { type: 'signal', signal: 'inflamacion' } }]);
    tutorial.observe(quiet);
    tutorial.observe({ ...quiet, signals: { citocinas: 1 } });
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, signals: { inflamacion: 0.001 } });
    expect(tutorial.active).toBe(true);
  });

  it('an enemy wait shows once an enemy of that id is on the board', () => {
    const tutorial = createTutorial([{ text: 'e', advance: { type: 'tap' }, waitFor: { type: 'enemy', enemy: 'streptococcus_pyogenes' } }]);
    tutorial.observe(quiet);
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, enemies: new Set(['bacteria_gram_pos']) });
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, enemies: new Set(['bacteria_gram_pos', 'streptococcus_pyogenes']) });
    expect(tutorial.active).toBe(true);
  });

  it('a status wait shows once some unit on the board carries that status', () => {
    const tutorial = createTutorial([{ text: 'i', advance: { type: 'tap' }, waitFor: { type: 'status', status: 'infectada' } }]);
    tutorial.observe(quiet);
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, statuses: new Set(['protegida']) });
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, statuses: new Set(['protegida', 'infectada']) });
    expect(tutorial.active).toBe(true);
  });

  it('an event wait shows once the sim has reported that event', () => {
    const tutorial = createTutorial([{ text: 'e', advance: { type: 'tap' }, waitFor: { type: 'event', event: 'enemy_switched_lane' } }]);
    tutorial.observe({ ...quiet, seen: new Set(['enemy_spawned']) });
    expect(tutorial.active).toBe(false);
    tutorial.observe({ ...quiet, seen: new Set(['enemy_spawned', 'enemy_switched_lane']) });
    expect(tutorial.active).toBe(true);
  });
});
