export const fx = (n: number, d = 2) => (Object.is(Math.round(n * 10 ** d), -0) ? 0 : n).toFixed(d)
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Small seeded random generator, so the same input always gives the same toy numbers. */
export function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
