/**
 * Headless text measuring: a conservative estimate of how wide a line of UI text is, greedy word
 * wrapping and font fitting. Phaser-free so layouts can be checked in tests; scenes still measure
 * the real text after drawing it and shrink it further if the estimate fell short.
 */

/** Narrow glyphs, as a share of the font size. */
const NARROW = new Set([...' .,:;!¡?¿\'"()[]|ijlftrI1']);
const WIDE = new Set([...'mwMW']);

/** Estimated width in pixels of `text` on one line, a little on the generous side. */
export function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  let em = 0;
  for (const ch of text) {
    if (NARROW.has(ch)) em += 0.34;
    else if (WIDE.has(ch)) em += 0.86;
    else if (ch !== ch.toLowerCase()) em += 0.7;
    else em += 0.58;
  }
  return em * fontSize * (bold ? 1.08 : 1);
}

/** Height of one line of text: the font size plus room for ascenders, descenders and accents. */
export function lineHeight(fontSize: number, lineSpacing = 0): number {
  return Math.ceil(fontSize * 1.25) + lineSpacing;
}

/** Splits `text` into lines no wider than `width` (a single word wider than that keeps its own line). */
export function wrapLines(text: string, width: number, fontSize: number, bold = false): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && estimateTextWidth(candidate, fontSize, bold) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Height of `text` wrapped to `width`, with `lineSpacing` extra pixels between lines. */
export function wrappedHeight(text: string, width: number, fontSize: number, lineSpacing = 0, bold = false): number {
  const count = wrapLines(text, width, fontSize, bold).length;
  return count * lineHeight(fontSize) + (count - 1) * lineSpacing;
}

export interface FitOptions {
  /** Largest font size to try, in pixels. */
  max: number;
  /** Smallest font size allowed; returned even when the text still does not fit. */
  min: number;
  lineSpacing?: number;
  bold?: boolean;
}

/** Largest whole font size from `max` down to `min` at which `text`, wrapped to `width`, fits in `height`. */
export function fitWrappedFont(text: string, width: number, height: number, options: FitOptions): number {
  const { max, min, lineSpacing = 0, bold = false } = options;
  for (let size = max; size > min; size--) {
    const lines = wrapLines(text, width, size, bold);
    const widest = Math.max(...lines.map((line) => estimateTextWidth(line, size, bold)));
    if (widest <= width && wrappedHeight(text, width, size, lineSpacing, bold) <= height) return size;
  }
  return min;
}

/** Largest whole font size from `max` down to `min` at which `text` fits on one line of `width`. */
export function fitLineFont(text: string, width: number, max: number, min: number, bold = false): number {
  for (let size = max; size > min; size--) {
    if (estimateTextWidth(text, size, bold) <= width) return size;
  }
  return min;
}
