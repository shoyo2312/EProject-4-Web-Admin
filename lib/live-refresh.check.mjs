// Run: node lib/live-refresh.check.mjs
import assert from "node:assert/strict";
import { createRefreshScheduler } from "./live-refresh.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

{
  let refreshes = 0;
  const scheduler = createRefreshScheduler({ refresh: () => refreshes++, windowMs: 20 });

  scheduler.request();
  scheduler.request();
  scheduler.request();
  assert.equal(refreshes, 0, "nothing runs before the window closes");

  await sleep(40);
  assert.equal(refreshes, 1, "a burst inside one window is one refresh");

  scheduler.request();
  await sleep(40);
  assert.equal(refreshes, 2, "a request after the window is a new refresh");
}

{
  let refreshes = 0;
  const scheduler = createRefreshScheduler({ refresh: () => refreshes++, windowMs: 20 });

  scheduler.request();
  scheduler.cancel();
  await sleep(40);
  assert.equal(refreshes, 0, "cancel drops the pending refresh");

  scheduler.request();
  await sleep(40);
  assert.equal(refreshes, 1, "the scheduler still works after a cancel");
}

console.log("live-refresh.check: ok");
