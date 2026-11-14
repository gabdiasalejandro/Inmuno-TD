/**
 * Marrow visuals. The ring shows the sim's own progress (`sim.marrowFraction()`), which already
 * includes any cytokine boost, so it always matches the real production.
 */

/** Ring fill from the sim fraction: 0 (just produced) to just under 1, never NaN. */
export function marrowCharge(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.max(0, Math.min(fraction, 0.999));
}

/** How hard the marrow looks like it is working, 0..1, from the cytokine level (0..1). */
export function marrowExcitement(cytokines: number): number {
  if (!Number.isFinite(cytokines) || cytokines <= 0.05) return 0;
  return Math.min(1, (cytokines - 0.05) / 0.5);
}
