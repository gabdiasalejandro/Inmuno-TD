import type { BossPhase, Content, EnemyDef, LevelDef, PowerDef, StatusDef, UnitDef } from '../sim';
import enemies from './enemies.json';
import introList from './intros.json';
import signals from './signals.json';
import statuses from './statuses.json';
import powers from './powers.json';
import units from './units.json';
import worldList from './worlds.json';

/** Game content as data. Numbers live in the JSON files so they can be reviewed without touching code. */
export const content: Content = {
  units: units as UnitDef[],
  powers: powers as PowerDef[],
  enemies: enemies as EnemyDef[],
  signals,
  statuses: statuses as Record<string, StatusDef>,
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

/**
 * Difficulties, easiest first. Sepsis plays the level files as they are; Normal plays them with
 * the override of `difficulty/normal/<level id>.json` on top, when the level has one.
 */
export const DIFFICULTIES = ['normal', 'sepsis'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Top-level level fields a difficulty may replace; the id always stays the base level's. */
export type LevelOverride = Partial<Omit<LevelDef, 'id'>>;

const normalFiles = import.meta.glob<LevelOverride>('./difficulty/normal/*.json', { eager: true, import: 'default' });

/** Normal overrides by level id, named after their files like the levels: no manual list. */
export const normalOverrides: Record<string, LevelOverride> = Object.fromEntries(
  Object.entries(normalFiles).map(([path, def]) => [path.slice('./difficulty/normal/'.length, -'.json'.length), def]),
);

/** Each field of the override replaces the base field whole (a wave list replaces all waves). */
export function applyOverride(base: LevelDef, override: LevelOverride): LevelDef {
  return { ...base, ...override, id: base.id };
}

/** The level as played on this difficulty, or undefined when there is no such level. */
export function resolveLevel(id: string, difficulty: Difficulty): LevelDef | undefined {
  const base = Object.hasOwn(levels, id) ? levels[id] : undefined;
  if (!base) return undefined;
  const override = difficulty === 'normal' ? normalOverrides[id] : undefined;
  return override ? applyOverride(base, override) : base;
}

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

/** Kind of signal source a tutorial step can ask about. */
export type TutorialSourceKind = 'unit' | 'wound';

/** What the arrow points at. Without a target the arrow follows the step's action. */
export type TutorialTarget =
  | { type: 'card'; unit: string }
  | { type: 'cell'; row: number; col: number }
  /** A unit of this definition already on the board. */
  | { type: 'unit'; unit: string }
  | { type: 'marrow' }
  | { type: 'meter' }
  /** The hold-to-release button of the HUD. */
  | { type: 'release_button' }
  /** A signal source that holds some charge (a unit or a wound's breach), optionally of one kind. */
  | { type: 'charged_source'; kind?: TutorialSourceKind }
  /** The tiered gauge of the level's damaging signal (inflammation). */
  | { type: 'gauge' }
  /** The frontmost enemy of this definition on the board. */
  | { type: 'enemy'; enemy: string }
  /** The first own unit (in deploy order) that carries this status, for example an infected cell. */
  | { type: 'status'; status: string }
  /** The power's medallion in the powers' section. */
  | { type: 'power'; power: string };

/** What the player must do for a step to end. */
export type TutorialAdvance =
  | { type: 'place'; unit: string; row?: number; col?: number }
  /** Play a power on a cell (any cell when row and col are omitted). */
  | { type: 'power'; power: string; row?: number; col?: number }
  /** Hold the release button for at least `seconds` (default: any press). */
  | { type: 'hold'; seconds?: number }
  | { type: 'tap' };

/** A condition a step can wait for before it shows. */
export type TutorialWait =
  /** Charge stored in all sources, in signal points, reaches `atLeast` (default: any charge). */
  | { type: 'stored'; atLeast?: number }
  /** A signal's level (0 to 1) reaches `atLeast` (default: any rise). */
  | { type: 'signal'; signal: string; atLeast?: number }
  /** The sim has reported an event of this type (for example `enemy_switched_lane`) at least once. */
  | { type: 'event'; event: string }
  /**
   * At least `atLeast` enemies with this id are on the board at once (default: one, the first of a
   * new kind arriving; a group's size waits until the whole group is out).
   */
  | { type: 'enemy'; enemy: string; atLeast?: number }
  /** Some unit on the board carries this status (for example the first infected cell). */
  | { type: 'status'; status: string }
  /** A boss on the board has reached this health phase (its toxins or its shield). */
  | { type: 'boss_phase'; phase: BossPhase };

export interface TutorialStep {
  /** i18n key of the tutor's line. */
  text: string;
  target?: TutorialTarget;
  advance: TutorialAdvance;
  /**
   * The step stays hidden, with the game running freely, until this holds. If the player does
   * the step's action while it is hidden, the step counts as done and never shows.
   */
  waitFor?: TutorialWait;
  /** Game speed while the step is hidden, waiting for `waitFor`: `fast` runs it at double speed. */
  waitTime?: 'normal' | 'fast';
  /** Game clock while the step waits: stopped (default), slowed or running. */
  time?: 'pause' | 'slow' | 'run';
  /** `locked` (default) ignores every action but the expected one; `free` blocks nothing. */
  input?: 'locked' | 'free';
}

export interface TutorialDef {
  steps: TutorialStep[];
}

/**
 * Every JSON file in `tutorials/` is the tutorial of the level named like the file
 * (`1-3.json` runs in level 1-3): adding a tutorial is adding a file, nothing else.
 */
const tutorialFiles = import.meta.glob<TutorialDef>('./tutorials/*.json', { eager: true, import: 'default' });

export const tutorials: Record<string, TutorialDef> = Object.fromEntries(
  Object.entries(tutorialFiles).map(([path, def]) => [path.slice('./tutorials/'.length, -'.json'.length), def]),
);
