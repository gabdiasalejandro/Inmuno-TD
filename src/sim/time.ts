/** Fixed simulation step, in milliseconds. The sim never reads wall-clock time. */
export const SIM_TICK_MS = 50;

export const TICKS_PER_SECOND = 1000 / SIM_TICK_MS;

/** Data files express durations in seconds; the sim counts whole ticks. */
export function secondsToTicks(seconds: number): number {
  return Math.round((seconds * 1000) / SIM_TICK_MS);
}
