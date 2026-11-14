/** Concept-card flow decisions. Phaser-free so they can be tested headless. */

import type { LevelIntro } from '../data';

/** The card shows on a first play of a level that has one; a retry goes straight to the banner. */
export function shouldShowIntro(intro: LevelIntro | undefined, retry: boolean): boolean {
  return intro !== undefined && !retry;
}
