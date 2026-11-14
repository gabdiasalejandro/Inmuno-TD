import { describe, expect, it } from 'vitest';
import es from '../../src/i18n/es.json';
import { createTranslator, t } from '../../src/i18n';

describe('translator', () => {
  it('returns the text for a known key', () => {
    expect(createTranslator({ 'a.b': 'Hola' })('a.b')).toBe('Hola');
  });

  it('returns the key itself for an unknown key instead of throwing', () => {
    expect(createTranslator({})('missing.key')).toBe('missing.key');
  });

  it('does not treat inherited object properties as keys', () => {
    expect(createTranslator({})('toString')).toBe('toString');
  });

  it('reads the Spanish dictionary by default', () => {
    expect(t('action.retry')).toBe(es['action.retry']);
  });

  it('has a message for every placement failure the HUD can show', () => {
    for (const reason of ['game_over', 'not_in_deck', 'out_of_bounds', 'cell_occupied', 'on_cooldown', 'insufficient_energy']) {
      expect(t(`feedback.${reason}`)).not.toBe(`feedback.${reason}`);
    }
  });
});
