/** What the scene shows for a level, decided from data. Phaser-free so it can be tested headless. */

import { TICKS_PER_SECOND, type LevelDef, type SignalDef, type UnitDef } from '../sim';

/** Signals that act in this level: all of the content's when the level does not restrict them. */
export function activeSignalNames(level: LevelDef, signals: Record<string, SignalDef> | undefined): string[] {
  const names = Object.keys(signals ?? {});
  return level.signals ? names.filter((name) => level.signals?.includes(name)) : names;
}

/**
 * Signals worth showing: active in the level and raised by some card of its deck. A level that
 * inherits every signal but cannot raise one (1-1) must not show a meter for a concept it has not taught.
 */
export function shownSignalNames(level: LevelDef, signals: Record<string, SignalDef> | undefined, units: UnitDef[]): string[] {
  const emitted = new Set(units.filter((u) => level.deck.includes(u.id) && u.emits).map((u) => u.emits?.signal));
  return activeSignalNames(level, signals).filter((name) => emitted.has(name));
}

/** Levels default to `clear`, like the sim. */
export function isClearLevel(level: LevelDef): boolean {
  return (level.win?.type ?? 'clear') === 'clear';
}

export function scheduledEnemies(level: LevelDef): number {
  return level.waves.reduce((sum, wave) => sum + wave.count, 0);
}

/** Enemies still to defeat: everything scheduled minus the ones already dead. */
export function bacteriaRemaining(level: LevelDef, defeated: number): number {
  return Math.max(0, scheduledEnemies(level) - defeated);
}

/**
 * How full a phagocyte still is after its bite: 1 right after eating, 0 when it can attack again.
 * `rate` is the attack's attacks per second.
 */
export function digestFraction(attackReadyAt: number, tick: number, rate: number): number {
  if (!(rate > 0)) return 0;
  const interval = Math.max(1, Math.round(TICKS_PER_SECOND / rate));
  return Math.max(0, Math.min(1, (attackReadyAt - tick) / interval));
}

/** Whether cytokines are currently speeding up this unit's redeploy (so its card should show it). */
export function isRecruitBoosted(
  def: UnitDef,
  signals: Record<string, SignalDef> | undefined,
  active: string[],
  level: (name: string) => number,
): boolean {
  return active.some((name) => {
    const signal = signals?.[name];
    if (!signal?.recruitBoost || !signal.recruitTag || !def.tags?.includes(signal.recruitTag)) return false;
    return level(name) > SIGNAL_RISEN;
  });
}

/** Cytokine fraction above which the meter counts as risen (matches the card boost badge). */
export const SIGNAL_RISEN = 0.05;

/**
 * Live speed multipliers the active signals grant: `1 + boost * level` for the marrow's production
 * and for the redeploy of the units the signal recruits. Same formula as the sim.
 */
export function cytokineEffects(
  signals: Record<string, SignalDef> | undefined,
  active: string[],
  level: (name: string) => number,
): { marrow: number; recruit: number } {
  let marrow = 0;
  let recruit = 0;
  for (const name of active) {
    const signal = signals?.[name];
    if (!signal) continue;
    marrow += (signal.marrowBoost ?? 0) * level(name);
    recruit += (signal.recruitBoost ?? 0) * level(name);
  }
  return { marrow: 1 + marrow, recruit: 1 + recruit };
}

/** The one-time explanation of the meter is due when it first rises and was not shown yet. */
export function cytokineHintDue(level: number | null, alreadyShown: boolean): boolean {
  return !alreadyShown && level !== null && level > SIGNAL_RISEN;
}
