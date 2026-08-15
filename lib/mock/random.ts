/**
 * Deterministic PRNG. Mock data must be identical on the server and on the client —
 * Math.random() would produce a different set per render and blow up hydration.
 */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

export function between(rand: () => number, min: number, max: number) {
  return Math.floor(min + rand() * (max - min + 1));
}

/**
 * Fixed clock for all mock timestamps. Same reason as the seeded PRNG: Date.now()
 * differs between the server render and the client hydration.
 */
export const MOCK_NOW = Date.parse("2026-08-13T09:00:00Z");
