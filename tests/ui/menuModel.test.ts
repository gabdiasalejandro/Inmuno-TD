import { describe, expect, it } from 'vitest';
import { buildMenu, nextPlayableLevel, type MenuLevelState } from '../../src/ui/menuModel';

const worlds = [
  { id: '1', levels: ['1-1', '1-2', '1-3'] },
  { id: '2', levels: [] },
];

function states(available: string[], completed: string[]): MenuLevelState[] {
  return buildMenu(worlds, new Set(available), completed)[0]!.levels.map((l) => l.state);
}

describe('buildMenu', () => {
  it('marks the first level playable and later ones locked when nothing is completed', () => {
    expect(states(['1-1', '1-2', '1-3'], [])).toEqual(['playable', 'locked', 'locked']);
  });

  it('marks completed levels and unlocks the next one', () => {
    expect(states(['1-1', '1-2', '1-3'], ['1-1'])).toEqual(['completed', 'playable', 'locked']);
  });

  it('shows a level without data as coming soon even when it is unlocked', () => {
    expect(states(['1-1'], ['1-1'])).toEqual(['completed', 'coming_soon', 'coming_soon']);
  });

  it('shows a locked level without data as coming soon, not locked', () => {
    expect(states(['1-1'], [])).toEqual(['playable', 'coming_soon', 'coming_soon']);
  });

  it('keeps a completed level completed', () => {
    expect(states(['1-1', '1-2', '1-3'], ['1-1', '1-2', '1-3'])).toEqual(['completed', 'completed', 'completed']);
  });

  it('reports worlds with no levels as coming soon', () => {
    const menu = buildMenu(worlds, new Set(['1-1']), []);
    expect(menu.map((w) => [w.id, w.comingSoon])).toEqual([
      ['1', false],
      ['2', true],
    ]);
    expect(menu[1]!.levels).toEqual([]);
  });

  it('keeps level ids in order with their number', () => {
    const levels = buildMenu(worlds, new Set(['1-1']), [])[0]!.levels;
    expect(levels.map((l) => l.id)).toEqual(['1-1', '1-2', '1-3']);
  });
});

describe('nextPlayableLevel', () => {
  it('points at the first level when nothing has been completed', () => {
    const menu = buildMenu(worlds, new Set(['1-1', '1-2', '1-3']), []);
    expect(nextPlayableLevel(menu)).toBe('1-1');
  });

  it('skips completed levels and stops at the next unlocked one', () => {
    const menu = buildMenu(worlds, new Set(['1-1', '1-2', '1-3']), ['1-1', '1-2']);
    expect(nextPlayableLevel(menu)).toBe('1-3');
  });

  it('returns null when everything built is completed', () => {
    const menu = buildMenu(worlds, new Set(['1-1', '1-2', '1-3']), ['1-1', '1-2', '1-3']);
    expect(nextPlayableLevel(menu)).toBeNull();
  });

  it('does not point at a coming-soon or locked level', () => {
    const menu = buildMenu(worlds, new Set(['1-1']), ['1-1']);
    expect(nextPlayableLevel(menu)).toBeNull();
  });
});
