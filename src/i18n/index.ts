import es from './es.json';
import esAlmanac from './es.almanac.json';

export type Dictionary = Record<string, string>;

/** Unknown keys come back as the key itself so a missing string is visible, never fatal. */
export function createTranslator(dictionary: Dictionary): (key: string) => string {
  return (key) => (Object.hasOwn(dictionary, key) ? (dictionary[key] as string) : key);
}

export const t = createTranslator({ ...es, ...esAlmanac });
