/** Guided tutorial progression. Phaser-free so it can be tested headless. */

import type { TutorialDef, TutorialStep, TutorialTarget, TutorialWait } from '../data';

/** Share of normal speed while a `slow` step waits for the player. */
export const SLOW_SCALE = 0.25;

/** Speed while a `fast` step waits hidden for its condition. */
export const FAST_SCALE = 2;

/** What the scene sees of the sim that a step can wait for. */
export interface TutorialObservation {
  /** Charge stored in all signal sources, in signal points. */
  stored: number;
  /** Level (0 to 1) of each active signal. */
  signals?: Readonly<Record<string, number>>;
  /** Types of the sim events reported so far in this play. */
  seen?: ReadonlySet<string>;
}

/** What the player tries to do, as the tutorial needs to know it. */
export type TutorialAction =
  | { type: 'select'; unit: string }
  | { type: 'place'; unit: string; row: number; col: number }
  /** The release button is (still) held, for `seconds` so far. */
  | { type: 'hold'; seconds: number }
  | { type: 'tap' };

export interface Tutorial {
  readonly finished: boolean;
  readonly index: number;
  /** Current step, or null when finished. */
  readonly step: TutorialStep | null;
  /** The current step is on screen: its `waitFor` condition has held at least once. */
  readonly active: boolean;
  /** 0 paused, `SLOW_SCALE` slowed, 1 normal. */
  readonly timeScale: number;
  observe(observation: TutorialObservation): void;
  /** Whether the player may do this right now. */
  allows(action: TutorialAction): boolean;
  /** Reports an action that really happened; true when it moved the tutorial on. */
  perform(action: TutorialAction): boolean;
}

function waitHolds(wait: TutorialWait, observation: TutorialObservation | null): boolean {
  if (!observation) return false;
  const reaches = (value: number, atLeast: number | undefined): boolean => (atLeast === undefined ? value > 0 : value >= atLeast);
  switch (wait.type) {
    case 'stored':
      return reaches(observation.stored, wait.atLeast);
    case 'signal':
      return reaches(observation.signals?.[wait.signal] ?? 0, wait.atLeast);
    case 'event':
      return observation.seen?.has(wait.event) ?? false;
  }
}

/** Whether an action is the kind the step expects, whatever its amount. */
function sameKind(step: TutorialStep, action: TutorialAction): boolean {
  return action.type === 'hold' ? step.advance.type === 'hold' : matches(step, action);
}

function matches(step: TutorialStep, action: TutorialAction): boolean {
  const { advance } = step;
  switch (action.type) {
    case 'place':
      return (
        advance.type === 'place' &&
        advance.unit === action.unit &&
        (advance.row === undefined || advance.row === action.row) &&
        (advance.col === undefined || advance.col === action.col)
      );
    case 'hold':
      return advance.type === 'hold' && action.seconds >= (advance.seconds ?? 0);
    case 'tap':
      return advance.type === 'tap';
    case 'select':
      return false;
  }
}

export function createTutorial(steps: readonly TutorialStep[]): Tutorial {
  let index = 0;
  let active = false;
  let last: TutorialObservation | null = null;

  const current = (): TutorialStep | null => steps[index] ?? null;
  const latch = (): void => {
    const step = current();
    if (!step || active) return;
    if (!step.waitFor || waitHolds(step.waitFor, last)) active = true;
  };
  latch();

  return {
    get finished() {
      return current() === null;
    },
    get index() {
      return index;
    },
    get step() {
      return current();
    },
    get active() {
      return active;
    },
    get timeScale() {
      const step = current();
      if (!step) return 1;
      if (!active) return step.waitTime === 'fast' ? FAST_SCALE : 1;
      const time = step.time ?? 'pause';
      return time === 'pause' ? 0 : time === 'slow' ? SLOW_SCALE : 1;
    },
    observe(observation) {
      last = observation;
      latch();
    },
    allows(action) {
      const step = current();
      if (!step || !active || step.input === 'free') return true;
      if (action.type === 'select') return step.advance.type === 'place' && step.advance.unit === action.unit;
      return sameKind(step, action);
    },
    perform(action) {
      const step = current();
      // A waited step the player completes before it shows is done too: it must not wait forever
      // for a condition the player's own action keeps from happening.
      if (!step || (!active && !step.waitFor) || !matches(step, action)) return false;
      index++;
      active = false;
      latch();
      return true;
    },
  };
}

/** A tutorial runs on levels that have one, until the player has beaten the level once. */
export function shouldRunTutorial(def: TutorialDef | undefined, levelCompleted: boolean): boolean {
  return def !== undefined && def.steps.length > 0 && !levelCompleted;
}

/**
 * What the step highlights: its own target, or by default what its action needs. A placement
 * highlights its card and, when the step fixes one, its cell, both at once (the first is the one
 * the arrow points at); a hold the release button; a tap nothing.
 */
export function targetsFor(step: TutorialStep): TutorialTarget[] {
  if (step.target) return [step.target];
  const { advance } = step;
  switch (advance.type) {
    case 'place': {
      const targets: TutorialTarget[] = [{ type: 'card', unit: advance.unit }];
      if (advance.row !== undefined && advance.col !== undefined) targets.push({ type: 'cell', row: advance.row, col: advance.col });
      return targets;
    }
    case 'hold':
      return [{ type: 'release_button' }];
    case 'tap':
      return [];
  }
}

/** Whether the step ends with the "Siguiente" button of its bubble. */
export function needsNext(step: TutorialStep): boolean {
  return step.advance.type === 'tap' && step.input !== 'free';
}
