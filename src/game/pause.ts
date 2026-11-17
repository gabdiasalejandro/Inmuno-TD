/** Pause rules. Phaser-free so they can be tested headless. */

export type PauseAction = 'resume' | 'restart' | 'menu';

/** Buttons of the pause panel, in display order. */
export const PAUSE_ACTIONS: readonly PauseAction[] = ['resume', 'restart', 'menu'];

/** The player can pause only while the level is being played: not on the concept card or the result screen. */
export function canPause(phase: 'intro' | 'play', status: 'playing' | 'won' | 'lost'): boolean {
  return phase === 'play' && status === 'playing';
}

/** The paused state after the pause button or the pause key: it always resumes, and pauses only when allowed. */
export function togglePause(paused: boolean, allowed: boolean): boolean {
  return paused ? false : allowed;
}
