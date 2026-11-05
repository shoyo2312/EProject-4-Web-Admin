// Run: node lib/__tests__/live-refresh.test.mjs
import assert from "node:assert/strict";
import { createRefreshScheduler, refreshesPage } from "../live-refresh.ts";

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

console.log("live-refresh: ok");

{
  const like = JSON.stringify({ type: "interaction.like-events" });
  const signup = JSON.stringify({ type: "UserRegisteredEvent" });

  assert.ok(refreshesPage(like, "/analytics"), "engagement refreshes analytics");
  assert.ok(refreshesPage(like, "/dashboard"), "engagement refreshes the dashboard");
  assert.ok(refreshesPage(like, "/videos/42"), "engagement refreshes a video's page");
  assert.ok(!refreshesPage(like, "/users"), "engagement leaves other pages alone");
  assert.ok(!refreshesPage(like, "/videos"), "the video list shows no engagement figures");
  assert.ok(refreshesPage(signup, "/users"), "every other frame still refreshes");
  assert.ok(refreshesPage("not json", "/users"), "an unreadable frame refreshes, as before");
}
