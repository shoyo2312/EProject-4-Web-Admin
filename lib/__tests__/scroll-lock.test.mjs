// Run: node lib/__tests__/scroll-lock.test.mjs
import assert from "node:assert/strict";
import { hasRoomToScroll } from "../scroll-lock.ts";

{
  // A list 1000px long with 400px of it showing.
  assert.equal(hasRoomToScroll(0, 1000, 400, 120), true, "at the top, it can go down");
  assert.equal(hasRoomToScroll(0, 1000, 400, -120), false, "but not further up");
  assert.equal(hasRoomToScroll(600, 1000, 400, 120), false, "at the bottom, not further down");
  assert.equal(hasRoomToScroll(600, 1000, 400, -120), true, "but back up");
  assert.equal(hasRoomToScroll(300, 1000, 400, 120), true, "in between, either way");
  assert.equal(hasRoomToScroll(300, 1000, 400, -120), true);
}

{
  assert.equal(hasRoomToScroll(0, 400, 400, 120), false, "a box that fits has nowhere to go");
  assert.equal(hasRoomToScroll(0, 400, 400, -120), false);
  assert.equal(hasRoomToScroll(300, 1000, 400, 0), false, "no movement is not a scroll");
}

{
  assert.equal(
    hasRoomToScroll(599.6, 1000, 400, 120),
    false,
    "a fraction of a pixel short of the end, as a zoomed page stops, is the end",
  );
  assert.equal(hasRoomToScroll(0.4, 1000, 400, -120), false, "and so is a fraction off the top");
}

console.log("scroll-lock: ok");
