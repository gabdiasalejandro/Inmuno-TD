/** Player progress, kept in the browser. No Phaser here so it can be tested headless. */

export interface Progress {
  /** Ids of the levels the player has won, in the order they were first won. */
  completed: string[];
}

export interface ProgressStore {
  load(): Progress;
  markCompleted(levelId: string): Progress;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'inmuno-td.progress.v1';

function parse(raw: string | null): Progress {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    const completed = (value as { completed?: unknown } | null)?.completed;
    if (Array.isArray(completed)) {
      return { completed: completed.filter((id): id is string => typeof id === 'string') };
    }
  } catch {
    // Corrupt data is treated as no data.
  }
  return { completed: [] };
}

/**
 * Storage may be missing (tests, server) or blocked (private mode): progress then lives in memory
 * for the session instead of breaking the game.
 */
export function createProgressStore(storage: KeyValueStorage | undefined): ProgressStore {
  let memory: Progress | undefined;

  const load = (): Progress => {
    if (memory) return { completed: [...memory.completed] };
    try {
      return parse(storage?.getItem(STORAGE_KEY) ?? null);
    } catch {
      return { completed: [] };
    }
  };

  return {
    load,
    markCompleted(levelId) {
      const progress = load();
      if (!progress.completed.includes(levelId)) progress.completed.push(levelId);
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch {
        memory = progress;
      }
      return { completed: [...progress.completed] };
    },
  };
}

/** A level is unlocked when it is the first of its list or the one before it has been completed. */
export function isUnlocked(levelIds: string[], completed: string[], levelId: string): boolean {
  const index = levelIds.indexOf(levelId);
  if (index < 0) return false;
  return index === 0 || completed.includes(levelIds[index - 1]!);
}

let browserStore: ProgressStore | undefined;

/** Shared store backed by the browser's localStorage. */
export function progressStore(): ProgressStore {
  browserStore ??= createProgressStore(typeof localStorage === 'undefined' ? undefined : localStorage);
  return browserStore;
}
