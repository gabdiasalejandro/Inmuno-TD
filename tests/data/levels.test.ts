import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content, levelIntros, levels, worlds } from '../../src/data';
import { createSim } from '../../src/sim';

const LEVEL_DIR = join(import.meta.dirname, '..', '..', 'src', 'data', 'levels');
const files = readdirSync(LEVEL_DIR).filter((name) => name.endsWith('.json'));

describe('level registry', () => {
  it('registers every level file under the id in its file name, with no manual list', () => {
    expect(Object.keys(levels).sort()).toEqual(files.map((name) => name.replace(/\.json$/, '')).sort());
    for (const [id, level] of Object.entries(levels)) expect(level.id).toBe(id);
  });

  it.each(Object.keys(levels))('level %s only references content that exists', (id) => {
    expect(() => createSim(levels[id]!, content, 1)).not.toThrow();
  });

  it('every registered level belongs to a world and every intro to a level', () => {
    const inWorlds = new Set(worlds.flatMap((world) => world.levels));
    expect(Object.keys(levels).filter((id) => !inWorlds.has(id))).toEqual([]);
    expect(Object.keys(levelIntros).filter((id) => !(id in levels))).toEqual([]);
  });
});
