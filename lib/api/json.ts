/**
 * Snowflake ids are Java `Long`s and serialize as bare JSON numbers up to 19 digits —
 * past Number.MAX_SAFE_INTEGER (2^53-1, 16 digits). JSON.parse would silently round
 * them, so a report id like 7250000000000012345 comes back as ...12344 and every
 * subsequent lookup 404s. Quote long integer values before parsing; the types in
 * types.ts declare all ids as `string` to match.
 *
 * The pattern consumes whole string literals too, and gives them back untouched: digits
 * inside a title or a comment are text, and a title like "Order: 1234567890123456, thanks"
 * quoted from the inside broke every listing that showed it. The lookbehind keeps it off
 * the fraction of a score that prints with seventeen decimals. A reviver reading
 * `context.source` would need no pattern, but Node 20, which Next still supports, has none.
 */
const STRING_OR_LONG_INTEGER = /"[^"\\]*(?:\\.[^"\\]*)*"|(?<![\d.eE+-])-?\d{16,}(?![\d.eE])/g;

export function parseWithLongIdsAsStrings<T>(text: string): T {
  return JSON.parse(
    text.replace(STRING_OR_LONG_INTEGER, (token) => (token.startsWith('"') ? token : `"${token}"`)),
  ) as T;
}
