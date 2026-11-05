/** Test helpers shared by the core unit tests. Excluded from coverage. */

/** Deterministic pseudo-random generator (Park–Miller) so tests are reproducible. */
export function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Normally distributed noise with standard deviation `sigma` (Box–Muller). */
export function gaussian(rand: () => number, sigma: number) {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function expectMatClose(a: readonly number[], b: readonly number[], tol = 1e-9) {
  expect(a).toHaveLength(b.length);
  a.forEach((v, i) => expect(Math.abs(v - (b[i] as number))).toBeLessThan(tol));
}
