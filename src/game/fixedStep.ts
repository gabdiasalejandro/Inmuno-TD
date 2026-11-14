/**
 * Fixed-step accumulator: turns variable frame deltas into whole simulation steps.
 * The step count per frame is capped so a long pause (background tab) cannot cause a
 * catch-up spiral; the backlog beyond the cap is dropped.
 */
export interface Stepper {
  /** Adds elapsed time; returns steps to run now and the 0..1 progress into the next step. */
  advance(deltaMs: number): { steps: number; alpha: number };
  reset(): void;
}

export function createStepper(stepMs: number, maxSteps: number): Stepper {
  let accumulated = 0;
  return {
    advance(deltaMs) {
      if (Number.isFinite(deltaMs) && deltaMs > 0) accumulated += deltaMs;
      const due = Math.floor(accumulated / stepMs);
      const steps = Math.min(due, maxSteps);
      accumulated -= steps * stepMs;
      if (due > maxSteps) accumulated %= stepMs;
      return { steps, alpha: accumulated / stepMs };
    },
    reset() {
      accumulated = 0;
    },
  };
}
