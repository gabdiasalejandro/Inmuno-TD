import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SIM_TICK_MS } from '../src/sim';

const SIM_DIR = join(import.meta.dirname, '..', 'src', 'sim');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('sim layer', () => {
  it('uses a fixed positive time step', () => {
    expect(SIM_TICK_MS).toBeGreaterThan(0);
  });

  it('never imports the engine, the render layer or the UI', () => {
    const forbidden = /from\s+['"](phaser|\.\.\/(game|ui)\b)/;
    const offenders = sourceFiles(SIM_DIR).filter((file) => forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
