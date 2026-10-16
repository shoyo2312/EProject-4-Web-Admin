// Run: node lib/__tests__/memo.test.mjs
import assert from "node:assert/strict";
import { memoizeFor } from "../memo.ts";

let now = 0;
const clock = () => now;

{
  let loads = 0;
  const get = memoizeFor(30_000, async () => ++loads, clock);

  assert.equal(await get(), 1);
  now = 29_999;
  assert.equal(await get(), 1, "inside the window the last result is served");
  now = 30_000;
  assert.equal(await get(), 2, "and reloaded once it has passed");
}

{
  // A burst of re-renders arriving together is one load, not one each.
  now = 0;
  let loads = 0;
  let resolve;
  const get = memoizeFor(30_000, () => {
    loads++;
    return new Promise((r) => (resolve = r));
  }, clock);
  const first = get();
  const second = get();
  resolve("feed");
  assert.deepEqual(await Promise.all([first, second]), ["feed", "feed"]);
  assert.equal(loads, 1);
}

{
  // A gateway that was down for one render must not keep the bell empty for the whole window.
  now = 0;
  let loads = 0;
  const get = memoizeFor(30_000, async () => {
    loads++;
    if (loads === 1) throw new Error("gateway down");
    return "feed";
  }, clock);
  await assert.rejects(get(), /gateway down/);
  assert.equal(await get(), "feed");
  assert.equal(loads, 2);
}

console.log("memo checks passed");
