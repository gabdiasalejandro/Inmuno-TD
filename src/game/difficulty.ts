/** The player's chosen difficulty, kept in the browser. No Phaser here so it can be tested headless. */
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from '../data';

export interface DifficultyStore {
  load(): Difficulty;
  save(difficulty: Difficulty): void;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'inmuno-td.difficulty.v1';

function parse(raw: string | null): Difficulty {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if ((DIFFICULTIES as readonly unknown[]).includes(value)) return value as Difficulty;
  } catch {
    // Corrupt data is treated as no choice.
  }
  return DEFAULT_DIFFICULTY;
}

/** Storage may be missing or blocked: the choice then lives in memory for the session. */
export function createDifficultyStore(storage: KeyValueStorage | undefined): DifficultyStore {
  let memory: Difficulty | undefined;
  return {
    load() {
      if (memory) return memory;
      try {
        return parse(storage?.getItem(STORAGE_KEY) ?? null);
      } catch {
        return DEFAULT_DIFFICULTY;
      }
    },
    save(difficulty) {
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem(STORAGE_KEY, JSON.stringify(difficulty));
      } catch {
        memory = difficulty;
      }
    },
  };
}

let browserStore: DifficultyStore | undefined;

/** Shared store backed by the browser's localStorage. */
export function difficultyStore(): DifficultyStore {
  browserStore ??= createDifficultyStore(typeof localStorage === 'undefined' ? undefined : localStorage);
  return browserStore;
}
