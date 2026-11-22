import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/i18n';
import esAlmanac from '../../src/i18n/es.almanac.json';
import { ALMANAC_ENTRIES, discoveredIds, type AlmanacEntry } from '../../src/ui/almanacModel';

const entries: AlmanacEntry[] = [
  { id: 'epitelio', kind: 'unit', category: 'barrier', note: false },
  { id: 'bacteria_gram_pos', kind: 'enemy', category: 'pathogen', note: false },
  { id: 'medula_osea', kind: 'structure', category: 'organ', note: false, alwaysDiscovered: true },
  { id: 'neutrofilo', kind: 'unit', category: 'innate_cell', note: false },
];

const worlds = [{ id: '1', levels: ['1-1', '1-2', '1-3'] }];
const levels = {
  '1-1': { deck: ['epitelio'], waves: [{ enemy: 'bacteria_gram_pos' }] },
  '1-2': { deck: ['epitelio', 'neutrofilo'], waves: [] },
};

describe('discoveredIds', () => {
  it('discovers a character by the deck of an unlocked level', () => {
    expect(discoveredIds(entries, worlds, levels, []).has('epitelio')).toBe(true);
  });

  it('discovers an enemy by a wave of an unlocked level', () => {
    expect(discoveredIds(entries, worlds, levels, []).has('bacteria_gram_pos')).toBe(true);
  });

  it('does not discover a character that only appears in a locked level', () => {
    expect(discoveredIds(entries, worlds, levels, []).has('neutrofilo')).toBe(false);
  });

  it('discovers it once the level before has been completed', () => {
    expect(discoveredIds(entries, worlds, levels, ['1-1']).has('neutrofilo')).toBe(true);
  });

  it('always includes an always-on entry, even with no level data at all', () => {
    expect([...discoveredIds(entries, [], {}, [])]).toEqual(['medula_osea']);
  });

  it('ignores a listed level that has no data yet', () => {
    // 1-3 is unlocked after 1-2 but has no data: it must not crash nor discover anything.
    expect(discoveredIds(entries, worlds, levels, ['1-1', '1-2']).size).toBe(4);
  });

  it('keeps an entry that exists in no level data undiscovered', () => {
    const lonely: AlmanacEntry = { id: 'macrofago', kind: 'unit', category: 'innate_cell', note: false };
    expect(discoveredIds([...entries, lonely], worlds, levels, ['1-1', '1-2']).has('macrofago')).toBe(false);
  });
});

describe('almanac content', () => {
  const t = createTranslator(esAlmanac);

  it('lists every character in the order the almanac shows them', () => {
    expect(ALMANAC_ENTRIES.map((e) => e.id)).toEqual(['epitelio', 'moco', 'bacteria_gram_pos', 'medula_osea', 'macrofago', 'neutrofilo', 'streptococcus_pyogenes', 'virus', 'nk', 'complemento', 'bacteria_gram_neg', 'bacteria_capsulada', 'dendritica']);
  });

  it('has a fact, a quote and a category label for every entry', () => {
    for (const e of ALMANAC_ENTRIES) {
      for (const key of [`almanac.${e.id}.fact`, `almanac.${e.id}.quote`, `almanac.category.${e.category}`]) {
        expect(t(key), key).not.toBe(key);
      }
    }
  });

  it('has both halves of the note for every entry that declares one', () => {
    for (const e of ALMANAC_ENTRIES.filter((x) => x.note)) {
      expect(t(`almanac.${e.id}.note_game`)).not.toBe(`almanac.${e.id}.note_game`);
      expect(t(`almanac.${e.id}.note_real`)).not.toBe(`almanac.${e.id}.note_real`);
    }
  });
});
