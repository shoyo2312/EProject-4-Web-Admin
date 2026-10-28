// Run: node lib/__tests__/entrance.test.mjs
import assert from "node:assert/strict";
import {
  BEAT_MS,
  DRAW_MS,
  createEntranceLog,
  drawnAtMs,
  lateDelayMs,
  spreadMs,
} from "../entrance.ts";

{
  const log = createEntranceLog();

  log.at("/dashboard", "");
  assert.equal(log.arrive(), true, "the first page of a visit plays");
  assert.equal(log.arrive(), true, "blocks streaming into the same view play with it");

  log.at("/analytics", "");
  assert.equal(log.arrive(), true, "a page not shown yet plays");

  log.at("/dashboard", "");
  assert.equal(log.arrive(), false, "coming back to a shown page does not");
  assert.equal(log.arrive(), false, "nor does anything inserted later in that view");
}

{
  const log = createEntranceLog();

  log.at("/videos", "");
  assert.equal(log.arrive(), true);

  log.at("/videos", "?status=PUBLISHED");
  assert.equal(log.arrive(), false, "another filter on a shown page is not a new page");

  log.at("/videos", "?status=PUBLISHED&page=2");
  assert.equal(log.arrive(), false, "nor is the next page of its table");
}

{
  const log = createEntranceLog();

  log.at("/users/1", "");
  assert.equal(log.arrive(), true);

  log.at("/users/2", "");
  assert.equal(log.arrive(), true, "each account's page is a page of its own");
}

{
  const log = createEntranceLog();

  log.at("/dashboard", "");
  assert.equal(log.arrive(), true);

  // Left while its loading state was up: none of its blocks ever went in.
  log.at("/analytics", "");

  log.at("/dashboard", "");
  assert.equal(log.arrive(), false, "the page left behind is still shown");

  log.at("/analytics", "");
  assert.equal(log.arrive(), true, "a page whose blocks never went in keeps its entrance");
}

{
  const log = createEntranceLog();

  log.at("/analytics", "");
  log.at("/analytics", "?period=month");
  assert.equal(log.arrive(), true, "a page whose URL settled before its blocks went in still plays");
}

{
  assert.equal(lateDelayMs(0), 0, "the first block into view starts at once");
  assert.equal(lateDelayMs(1), BEAT_MS, "the next one a beat later");
  assert.equal(lateDelayMs(5), 5 * BEAT_MS);
  assert.equal(lateDelayMs(12), 5 * BEAT_MS, "a long jump down waits no more than the cap");
}

{
  assert.equal(spreadMs(0, 13), 0, "the first mark draws with its chart");
  assert.equal(spreadMs(12, 13), 360, "a dozen bars fill the run");
  assert.equal(spreadMs(29, 30), 360, "thirty bars fit the same run");
  assert.equal(spreadMs(4, 5), 180, "a short run keeps its step rather than stretching out");
  assert.equal(spreadMs(0, 1), 0, "a single mark does not wait");
}

{
  assert.equal(drawnAtMs(0), 0, "the line starts at its first point");
  assert.equal(drawnAtMs(1), DRAW_MS, "and reaches its last as the drawing ends");
  assert.equal(drawnAtMs(0.875), DRAW_MS / 2, "fast out of the gate: seven eighths across by half time");
  assert.ok(drawnAtMs(0.25) < drawnAtMs(0.5), "a point further right is reached later");
}

console.log("entrance: ok");
