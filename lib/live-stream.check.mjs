import assert from "node:assert/strict";
import { createRefreshScheduler } from "./live-refresh.ts";
import { createLiveStream } from "./live-stream.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup() {
  const sources = [];
  let refreshes = 0;
  const stream = createLiveStream({
    open: () => {
      const source = {
        readyState: 0,
        closed: false,
        onopen: null,
        onmessage: null,
        onerror: null,
        listeners: {},
        addEventListener(type, listener) {
          (this.listeners[type] ??= []).push(listener);
        },
        close() {
          this.readyState = 2;
          this.closed = true;
        },
      };
      sources.push(source);
      return source;
    },
    scheduler: createRefreshScheduler({ refresh: () => refreshes++, windowMs: 20 }),
    retryMs: 20,
  });
  const last = () => sources.at(-1);
  return {
    stream,
    sources,
    last,
    refreshes: () => refreshes,
    open: (s = last()) => {
      s.readyState = 1;
      s.onopen?.();
    },
    // The relay has reached chat-service and subscribed.
    ready: (s = last()) => s.listeners.ready?.forEach((listener) => listener()),
    message: (s = last()) => s.onmessage?.(),
    // A network error: the browser reconnects on its own.
    drop: (s = last()) => {
      s.readyState = 0;
      s.onerror?.();
    },
    // A non-200 or non-event-stream answer: the browser gives up.
    fail: (s = last()) => {
      s.readyState = 2;
      s.onerror?.();
    },
  };
}

{
  const t = setup();
  t.stream.show(false);
  t.open();
  t.ready();
  await sleep(40);
  assert.equal(t.refreshes(), 0, "the first open is not a catch-up");
  t.message();
  await sleep(40);
  assert.equal(t.refreshes(), 1, "a pushed change refreshes");
}

{
  const t = setup();
  t.stream.show(false);
  t.open();
  t.drop();
  t.open();
  t.ready();
  await sleep(40);
  assert.equal(t.refreshes(), 1, "reconnecting after a drop catches up once");
}

{
  const t = setup();
  t.stream.show(false);
  t.open();
  t.drop();
  t.open();
  t.drop();
  await sleep(40);
  assert.equal(t.refreshes(), 0, "a relay that opens and fails during an outage does not refresh");
}

{
  const t = setup();
  t.stream.show(false);
  t.open();
  t.drop();
  t.open();
  await sleep(40);
  t.drop();
  t.open();
  await sleep(40);
  assert.equal(t.refreshes(), 0, "nor when it takes longer than the refresh window to fail");
  t.ready();
  await sleep(40);
  assert.equal(t.refreshes(), 1, "the catch-up comes once chat-service is back");
}

{
  const t = setup();
  t.stream.show(false);
  t.open();
  t.message();
  t.stream.hide();
  assert.equal(t.sources[0].closed, true, "an open stream is closed when the tab hides");
  await sleep(40);
  assert.equal(t.refreshes(), 0, "hiding cancels a pending refresh");
  t.stream.show(true);
  assert.equal(t.sources.length, 2);
  await sleep(40);
  assert.equal(t.refreshes(), 0, "the catch-up waits for the stream to open");
  t.open();
  await sleep(40);
  assert.equal(t.refreshes(), 0, "and for the relay to be ready");
  t.ready();
  await sleep(40);
  assert.equal(t.refreshes(), 1, "and then refreshes once");
}

{
  const t = setup();
  t.stream.show(true);
  const connecting = t.last();
  t.stream.hide();
  assert.equal(connecting.closed, false, "a connecting stream is not aborted");
  t.open(connecting);
  assert.equal(connecting.closed, true, "it is closed once it answers");
  await sleep(40);
  assert.equal(t.refreshes(), 0, "and it does not refresh the hidden page");

  t.stream.show(false);
  const again = t.last();
  t.stream.hide();
  t.drop(again);
  assert.equal(again.closed, true, "a connecting stream that errors is closed too");
}

{
  const t = setup();
  t.stream.show(false);
  t.fail();
  await sleep(40);
  assert.equal(t.sources.length, 2, "a fatal close is retried");
  t.open();
  t.drop();
  t.fail();
  await sleep(40);
  assert.equal(t.sources.length, 3, "an open re-arms the retry");
  t.fail();
  await sleep(40);
  assert.equal(t.sources.length, 3, "one retry per failure, so a dead session cannot loop");
}

{
  const t = setup();
  t.stream.show(false);
  t.fail();
  t.stream.hide();
  await sleep(40);
  assert.equal(t.sources.length, 1, "hiding cancels a pending retry");
}

{
  const t = setup();
  t.stream.show(false);
  t.stream.show(true);
  t.open();
  t.stream.show(true);
  assert.equal(t.sources.length, 1, "showing a tab that already has a stream opens no second one");
}

console.log("live-stream.check: ok");
