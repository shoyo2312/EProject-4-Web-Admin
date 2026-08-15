/**
 * Snowflake ids are Java `Long`s and serialize as bare JSON numbers up to 19 digits —
 * past Number.MAX_SAFE_INTEGER (2^53-1, 16 digits). JSON.parse would silently round
 * them, so a report id like 7250000000000012345 comes back as ...12344 and every
 * subsequent lookup 404s. Quote long integer values before parsing; the types in
 * types.ts declare all ids as `string` to match.
 *
 * A reviver cannot fix this — by the time it runs, the number is already rounded.
 */
const LONG_INTEGER_VALUE = /:\s*(-?\d{16,})(?=\s*[,}\]])/g;

export function parseWithLongIdsAsStrings<T>(text: string): T {
  return JSON.parse(text.replace(LONG_INTEGER_VALUE, ': "$1"')) as T;
}
