/**
 * The current query string with a few keys changed, as an href.
 *
 * Built from the params that are already there rather than from scratch, so changing one
 * control never silently drops another — a status filter that wiped the header's date would
 * show rows the date picker excludes. A null value removes the key; filters at their default
 * are removed rather than written, because a parameter sitting at its default is noise in the
 * address bar.
 *
 * Callers that change *what* is listed pass `page: null` too: page 3 of the previous result
 * set is not page 3 of this one, and is usually past its end.
 */
export function hrefWith(
  pathname: string,
  params: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
