import { describe, expect, it } from 'vitest';
import { cursorFor } from '../../src/game/cursor';

describe('cursorFor', () => {
  it('is a pointer over clickable targets and the default arrow elsewhere', () => {
    expect(cursorFor(true)).toBe('pointer');
    expect(cursorFor(false)).toBe('default');
  });
});
