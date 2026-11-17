import { describe, expect, it } from 'vitest';
import { PAUSE_ACTIONS, canPause, togglePause } from '../../src/game/pause';

describe('canPause', () => {
  it('allows pausing only while the level is being played', () => {
    expect(canPause('play', 'playing')).toBe(true);
    expect(canPause('intro', 'playing')).toBe(false);
    expect(canPause('play', 'won')).toBe(false);
    expect(canPause('play', 'lost')).toBe(false);
  });
});

describe('togglePause', () => {
  it('pauses when allowed and resumes always', () => {
    expect(togglePause(false, true)).toBe(true);
    expect(togglePause(false, false)).toBe(false);
    expect(togglePause(true, true)).toBe(false);
    expect(togglePause(true, false)).toBe(false);
  });
});

describe('pause actions', () => {
  it('lists continue, restart and menu, in that order', () => {
    expect(PAUSE_ACTIONS).toEqual(['resume', 'restart', 'menu']);
  });
});
