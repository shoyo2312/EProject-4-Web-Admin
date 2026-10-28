/**
 * Whether a box scrolled to `position` along one axis — `extent` long in all, with `viewport` of it
 * showing — can still move by `delta` on its own. A pixel of slack at each end, for the fraction of
 * a pixel a zoomed page leaves between where the box stopped and where its edge is.
 */
export function hasRoomToScroll(
  position: number,
  extent: number,
  viewport: number,
  delta: number,
): boolean {
  if (delta > 0) return position + viewport < extent - 1;
  if (delta < 0) return position > 1;
  return false;
}
