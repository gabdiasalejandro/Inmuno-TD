import type { Content, EnemyDef, LevelDef, UnitDef } from '../sim';
import enemies from './enemies.json';
import introList from './intros.json';
import level_1_1 from './levels/1-1.json';
import level_1_2 from './levels/1-2.json';
import level_1_3 from './levels/1-3.json';
import signals from './signals.json';
import units from './units.json';
import worldList from './worlds.json';

/** Game content as data. Numbers live in the JSON files so they can be reviewed without touching code. */
export const content: Content = {
  units: units as UnitDef[],
  enemies: enemies as EnemyDef[],
  signals,
};

export const levels: Record<string, LevelDef> = {
  '1-1': level_1_1 as LevelDef,
  '1-2': level_1_2 as LevelDef,
  '1-3': level_1_3 as LevelDef,
};

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
