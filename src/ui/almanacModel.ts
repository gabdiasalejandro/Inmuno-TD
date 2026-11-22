import { isUnlocked } from '../game/progress';

/** What the almanac knows about each character. Phaser-free so it can be tested headless. */

export type AlmanacCategory = 'barrier' | 'innate_cell' | 'organ' | 'pathogen' | 'system';

export interface AlmanacEntry {
  id: string;
  /** Where the game files the character; also picks the default name key (`unit.<id>.name`). */
  kind: 'unit' | 'enemy' | 'structure';
  category: AlmanacCategory;
  /** Name key when the default one does not apply (the bone marrow is not a unit). */
  nameKey?: string;
  /** True when `docs/simplificaciones.md` has a simplification about this character. */
  note: boolean;
  /** Visible from the start, whatever the levels say (the bone marrow is always there). */
  alwaysDiscovered?: boolean;
}

export const ALMANAC_ENTRIES: readonly AlmanacEntry[] = [
  { id: 'epitelio', kind: 'unit', category: 'barrier', note: true },
  { id: 'moco', kind: 'unit', category: 'barrier', note: true },
  { id: 'bacteria_gram_pos', kind: 'enemy', category: 'pathogen', note: false },
  { id: 'medula_osea', kind: 'structure', category: 'organ', nameKey: 'hud.marrow', note: true, alwaysDiscovered: true },
  { id: 'macrofago', kind: 'unit', category: 'innate_cell', note: false },
  { id: 'neutrofilo', kind: 'unit', category: 'innate_cell', note: true },
  { id: 'streptococcus_pyogenes', kind: 'enemy', category: 'pathogen', note: true },
  { id: 'virus', kind: 'enemy', category: 'pathogen', note: true },
  { id: 'nk', kind: 'unit', category: 'innate_cell', note: true },
  { id: 'complemento', kind: 'unit', category: 'system', note: true },
  { id: 'bacteria_gram_neg', kind: 'enemy', category: 'pathogen', note: true },
  { id: 'bacteria_capsulada', kind: 'enemy', category: 'pathogen', note: true },
  { id: 'dendritica', kind: 'unit', category: 'innate_cell', note: true },
];

/** Translation keys to try for the real name, best first: the game's own, then the almanac's fallback. */
export function nameKeys(entry: AlmanacEntry): string[] {
  const own = entry.nameKey ?? `${entry.kind === 'enemy' ? 'enemy' : 'unit'}.${entry.id}.name`;
  return [own, `almanac.${entry.id}.name`];
}

interface LevelContent {
  deck: readonly string[];
  waves: readonly { enemy: string }[];
}

/**
 * Ids of the entries the player has reached: always-on entries, plus every character that appears
 * (in the deck or as a wave's enemy) in a level that has data and is unlocked per `isUnlocked`.
 * A character that appears in no level data yet stays undiscovered.
 */
export function discoveredIds(
  entries: readonly AlmanacEntry[],
  worlds: readonly { levels: readonly string[] }[],
  levels: Readonly<Record<string, LevelContent>>,
  completed: readonly string[],
): Set<string> {
  const seen = new Set<string>();
  for (const world of worlds) {
    const list = [...world.levels];
    for (const id of list) {
      const level = Object.hasOwn(levels, id) ? levels[id] : undefined;
      if (!level || !isUnlocked(list, [...completed], id)) continue;
      for (const unit of level.deck) seen.add(unit);
      for (const wave of level.waves) seen.add(wave.enemy);
    }
  }
  return new Set(entries.filter((e) => e.alwaysDiscovered || seen.has(e.id)).map((e) => e.id));
}
