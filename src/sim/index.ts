/**
 * Pure simulation layer. Nothing in this folder may import Phaser or touch the DOM:
 * it must run headless under Vitest and survive an engine change.
 */
export { createRng, type Rng } from './rng';
export { createSim } from './sim';
export { SIM_TICK_MS, TICKS_PER_SECOND, secondsToTicks } from './time';
export type * from './types';
