import type { Content, EnemyDef, LevelDef, UnitDef } from '../sim';
import enemies from './enemies.json';
import introList from './intros.json';
import signals from './signals.json';
import units from './units.json';
import worldList from './worlds.json';

/** Game content as data. Numbers live in the JSON files so they can be reviewed without touching code. */
export const content: Content = {
  units: units as UnitDef[],
  enemies: enemies as EnemyDef[],
  signals,
};

/**
 * Every JSON file in `levels/` is a level: adding a level is adding a file, nothing else.
 * The file name must be the level id.
 */
const levelFiles = import.meta.glob<LevelDef>('./levels/*.json', { eager: true, import: 'default' });

export const levels: Record<string, LevelDef> = Object.fromEntries(
  Object.entries(levelFiles).map(([path, level]) => {
    const fileId = path.slice('./levels/'.length, -'.json'.length);
    if (level.id !== fileId) throw new Error(`Level file ${path} declares id "${level.id}"`);
    return [fileId, level];
  }),
);

export interface WorldDef {
  id: string;
  /** Level ids in play order. A level is playable only if it also exists in `levels`. */
  levels: string[];
}

export const worlds: WorldDef[] = worldList;

/** What the player is shown before a level starts. All text fields are i18n keys. */
export interface LevelIntro {
  title: string;
  body: string;
  /** Definition ids of the characters the card presents. */
  feature: string[];
  /** Short call to action shown big when play begins. */
  banner: string;
}

export const levelIntros: Record<string, LevelIntro> = introList;
