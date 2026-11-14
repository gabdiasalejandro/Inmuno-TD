/** Development shortcut: `?level=<id>` boots straight into that level when it has data. */
export function startLevelFromSearch(search: string, levels: Readonly<Record<string, unknown>>): string | null {
  const id = new URLSearchParams(search).get('level');
  if (!id || !Object.hasOwn(levels, id)) return null;
  return id;
}

/** Development shortcut: `?almanac=1` opens the almanac directly. */
export function openAlmanacFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('almanac') === '1';
}
