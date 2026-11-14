import { describe, expect, it } from 'vitest';
import { shouldShowIntro } from '../../src/game/intro';

const intro = { title: 't', body: 'b', feature: [], banner: 'x' };

describe('shouldShowIntro', () => {
  it('shows the card on a first play of a level that has an intro', () => {
    expect(shouldShowIntro(intro, false)).toBe(true);
  });

  it('skips the card on a retry', () => {
    expect(shouldShowIntro(intro, true)).toBe(false);
  });

  it('starts directly when the level has no intro', () => {
    expect(shouldShowIntro(undefined, false)).toBe(false);
  });
});
