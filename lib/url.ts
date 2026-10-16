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

/**
 * A path and every path above it, deepest first: "/users/1/activity", "/users/1", "/users".
 * The root is left out — nothing is named after it.
 */
export function ancestors(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((_, i) => `/${segments.slice(0, segments.length - i).join("/")}`);
}

/**
 * A `?next=` value as a path on this origin, or null when it is not one.
 *
 * Resolved against a placeholder origin rather than checked for a leading "/", because the URL
 * parser is what the browser will apply: "//evil.example", "/\evil.example" and "/\t/evil.example"
 * all start with a slash and all leave the site.
 */
export function internalPath(next: string | null): string | null {
  if (!next) return null;
  const base = "http://internal.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return null;
  }
  return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : null;
}
