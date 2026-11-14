/** Formats a number of seconds as m:ss, rounding fractions up. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Signed amount for floating gain labels, e.g. "+25". */
export function formatGain(amount: number): string {
  return `+${Math.round(amount)}`;
}

/** Scale (at most 1) that makes content `width` wide fit within `max`. */
export function fitScale(width: number, max: number): number {
  if (!(width > 0) || !(max > 0)) return 1;
  return Math.min(1, max / width);
}

/** Speed multiplier as shown to the player: "x1", "x1.4", "x2". One decimal at most. */
export function formatMultiplier(multiplier: number): string {
  const tenths = Math.round(multiplier * 10);
  return `x${tenths % 10 === 0 ? tenths / 10 : (tenths / 10).toFixed(1)}`;
}

/** Whether the multiplier reads above x1 once formatted. */
export function isSpedUp(multiplier: number): boolean {
  return Math.round(multiplier * 10) > 10;
}
