// Numbers rather than EventSource.CONNECTING/CLOSED: Node has no EventSource global, and the check
// script runs there.
const CONNECTING = 0;
const CLOSED = 2;

/**
 * The page's /api/live stream. Only a visible tab holds one: hidden tabs would otherwise use up the
 * browser's six connections per origin, and the catch-up refresh on return covers anything missed,
 * including the trash expiry warning, which is a date passing rather than an event.
 *
 * When the access cookie has lapsed, the stream request is what spends the single-use refresh
 * token in middleware.ts, and three rules follow from that:
 * - A catch-up refresh waits for `open`, by which point the rotated cookies are stored. Sent
 *   alongside the stream request, it would race it for the rotation.
 * - A stream that is still connecting is never aborted, only closed once it answers. Aborting
 *   drops the Set-Cookie carrying the rotated tokens, and the next request then presents the spent
 *   token after auth-service's 10s grace, which revokes every session the admin has.
 * - A fatal close is retried once. It happens when another window won the rotation and this
 *   request was redirected to an HTML page; without the retry this page stops updating until it
 *   is hidden and shown again. Only once, so a dead session cannot loop.
 *
 * An error also cancels a refresh still pending: while chat-service is down the relay opens and
 * fails within a second, and each ~3s reconnect would otherwise re-render the page.
 */
export function createLiveStream({
  open,
  scheduler,
  retryMs = 3000,
}: {
  open: () => EventSource;
  scheduler: { request(): void; cancel(): void };
  retryMs?: number;
}) {
  let source: EventSource | null = null;
  let stale = false;
  let retried = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retry) clearTimeout(retry);
    retry = null;
  };

  const connect = () => {
    clearRetry();
    const s = open();
    source = s;
    s.onmessage = () => scheduler.request();
    s.onopen = () => {
      retried = false;
      if (!stale) return;
      stale = false;
      scheduler.request();
    };
    s.onerror = () => {
      stale = true;
      scheduler.cancel();
      if (s.readyState !== CLOSED || retried) return;
      retried = true;
      retry = setTimeout(connect, retryMs);
    };
  };

  return {
    /** `catchUp` refreshes the page once the stream opens, for a tab that was hidden. */
    show(catchUp: boolean) {
      if (source && source.readyState !== CLOSED) return;
      retried = false;
      if (catchUp) stale = true;
      connect();
    },
    hide() {
      clearRetry();
      scheduler.cancel();
      const s = source;
      source = null;
      if (!s) return;
      if (s.readyState !== CONNECTING) {
        s.close();
        return;
      }
      s.onopen = s.onerror = () => s.close();
    },
  };
}
