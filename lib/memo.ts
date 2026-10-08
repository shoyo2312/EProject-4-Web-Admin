/**
 * `load`, answered from its last result for `ttlMs` after the load that produced it started.
 *
 * The promise itself is kept, so calls that arrive while a load is in flight share it rather than
 * starting their own. A rejection is not kept: the next call loads again instead of serving the
 * failure for the rest of the window.
 */
export function memoizeFor<T>(
  ttlMs: number,
  load: () => Promise<T>,
  clock: () => number = Date.now,
): () => Promise<T> {
  let cached: { at: number; value: Promise<T> } | null = null;

  return () => {
    if (cached && clock() - cached.at < ttlMs) return cached.value;
    const entry = { at: clock(), value: load() };
    cached = entry;
    entry.value.catch(() => {
      if (cached === entry) cached = null;
    });
    return entry.value;
  };
}
