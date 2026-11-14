export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Serializable internal state, so a sim snapshot can resume the same sequence. */
  readonly state: number;
}

/** mulberry32: small, fast, and identical on every platform because it is pure 32-bit integer math. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return s;
    },
  };
}
