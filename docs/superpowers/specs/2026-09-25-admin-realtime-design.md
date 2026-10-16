# Admin console: real-time updates instead of 15s polling

**Date:** 2026-09-25
**Repos:** `tiktok-backend` (admin-service, chat-service, event-schema), `tiktok-admin`
**Status:** approved design, awaiting spec review

## Goal

Replace `AutoRefresh` (a `router.refresh()` every 15s on every admin page) with server push. When
something an admin cares about happens — a report is filed or resolved, a video is moderated,
trashed, purged, taken down — the open page and the topbar bell update within about a second.

## Decisions already made

- **Scope:** every admin page, not only the bell. `AutoRefresh` is deleted, not kept as a fallback.
- **Alerting:** page + bell only. No toasts, sounds or browser notifications.
- **Transport:** approach A — the admin app relays chat-service's STOMP socket to the browser as
  SSE, so the httpOnly access token never reaches browser JavaScript.
- **Scale assumption:** a handful of admins; ~1s latency counts as real-time.

## How it works

Server events are thin signals ("something of kind X changed"). On a signal the browser calls
`router.refresh()`: the current page's server components re-render and re-read through REST, exactly
as `AutoRefresh` did, but only when something changed. Server components stay the source of truth;
no page grows its own live-update code.

```
user files report ─► admin-service ─outbox─► admin.report-events ─┐
admin action ──────► admin-service ─outbox─► admin.moderation-events ─┤
media-worker verdict ─────────────────────► media.video-moderation-events ─┼─► chat-service AdminFanout
video-service trash/purge/publish ────────► video.video-events ─┘        │  /topic/admin (ADMIN only)
                                                                          ▼
                              gateway /ws ◄── STOMP ── tiktok-admin /api/live (route handler)
                                                                          │  SSE
                                                                          ▼
                                                       LiveRefresh ─► router.refresh()
```

## 1. Backend events — admin-service

**New events** in `libs/event-schema`, package `com.tiktok.event.admin`, following the existing
`record … implements DomainEvent` + static `of(...)` shape:

- `ReportSubmittedEvent(eventId, occurredAt, reportId, targetType, targetId)`
- `ReportResolvedEvent(eventId, occurredAt, targetType, targetId)`

Neither carries the reason text or the reporter: the console re-reads everything through REST.

**Where they are written** (same transaction, through the existing outbox, aggregate type `REPORT`):

- `AdminServiceImpl.submitReport` — only when a new report is saved as `PENDING`. A repeat
  submission (returns the existing report) and a report closed on arrival (`alreadyEnforced`) write
  nothing.
- `ReportResolvedEvent` next to both `reportRepository.closePendingFor(...)` calls: in
  `resolveReport`, and in `moderate` when `actionType.answersReports()`. This covers
  `DISMISS_REPORT`, which today emits no event at all.

**Topic routing:** `OutboxPublisher` publishes aggregate type `REPORT` to a new topic
`admin.report-events`; everything else stays on `admin.moderation-events`. The six existing
consumers of `admin.moderation-events` are untouched. The topic is auto-created
(`KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`). The `eventType` header is set as for every other outbox
event.

**Outbox poll:** `OutboxPublisher` polled every 5000 ms, which alone could delay a report by 5s.
It becomes `@Scheduled(fixedDelayString = "${admin.outbox.poll-millis}")` with `poll-millis: 500`.
Cheap: unpublished rows sit in the partial index `idx_outbox_events_unpublished`. video-service's
own outbox still polls every 5s, so trash/purge/publish signals can lag up to ~5s; unchanged here.

**Not covered:** `StaleReportSweep`'s automatic closures emit nothing. Those rows drop out of the
bell on the next event, navigation or tab return.

## 2. Socket channel — chat-service

**`realtime/AdminFanout`** — `@KafkaListener` on `admin.report-events`, `admin.moderation-events`,
`media.video-moderation-events`, `video.video-events`. For every record it sends
`AdminFrame(type)` to `/topic/admin`, where `type` is the `eventType` header, or the topic name when
the producer set no header. No payload parsing, no filtering, no server-side batching (the browser
coalesces). It uses its **own** consumer group, `admin-realtime-${random.uuid}`: the service-wide
`realtime-${random.uuid}` group is shared by every listener, and `VideoStateFanout` already
consumes three of these topics — two listeners in one group split a topic's partitions, so each
would silently miss part of the stream. A per-instance group still means every instance sees every
event and serves its own sockets.

**Admin-only destination:**

- `JwtHandshakeInterceptor` also stores the token's `role` claim (`"role"`, values `USER`/`ADMIN`)
  as a handshake attribute.
- `StompSubscriptionInterceptor` allows `^/topic/admin$` only when the session's role attribute is
  `ADMIN`; any other subscriber gets the same refusal as an unknown destination.
- A demoted admin keeps the subscription until their token expires, and
  `WebSocketSessionRegistry`'s existing sweep closes sockets whose token expired or was revoked —
  the same window REST has.

## 3. Relay — tiktok-admin server side

- **`lib/api/client.ts`** gains `gatewaySocketUrl(): Promise<string | null>` — the gateway's
  `/ws` URL (`ws:`/`wss:` from `GATEWAY_URL`) with `?token=<session token>`, or `null` without a
  session. Reading the token stays inside the one client module.
- **`lib/api/live.ts`** — `subscribeAdminLive(brokerURL, { onFrame, onClose }): () => void`. The
  route calls `gatewaySocketUrl()` first so it can answer 401 before streaming. Opens an
  `@stomp/stompjs` `Client` on that URL (Node 26's global `WebSocket`; no `ws` package) with
  `reconnectDelay: 0`, subscribes to `/topic/admin`, calls `onFrame` per message and `onClose` once
  when the socket closes or STOMP reports an error. Returns a function that deactivates the client.
  Its own reconnect is off on purpose: the browser's `EventSource` reconnect is what passes through
  the middleware and picks up a refreshed token.
- **`app/api/live/route.ts`** — `GET`, returns a `ReadableStream` with
  `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`.
  - First writes `retry: 3000`.
  - Each frame → `data: <json>\n\n`. A `: ping` comment every 25s keeps proxies from idling it out.
  - Upstream `onClose` → close the stream. `request.signal` abort → deactivate the STOMP client and
    clear the ping timer.
  - No session → `401`. `USE_MOCK` → `204` (tells `EventSource` to stop retrying).
- New dependency: `@stomp/stompjs` (same major as `tiktok-cloned`, ^7).

## 4. Browser — tiktok-admin

- **Delete** `components/layout/auto-refresh.tsx`; the admin layout renders `<LiveRefresh />` in
  its place (still skipped under `USE_MOCK`).
- **`components/layout/live-refresh.tsx`** (client component, renders nothing):
  - While the tab is visible it holds `new EventSource("/api/live")`.
  - Each message asks the scheduler for a refresh.
  - On `visibilitychange` to hidden it closes the `EventSource`; back to visible it reopens it and
    refreshes once. Hidden tabs hold no connection, so many open tabs cannot exhaust the browser's
    6-connections-per-origin limit, and the refresh on return catches up on whatever was missed —
    including the trash "erased soon" warning, which is a date passing rather than an event.
  - An `open` event that follows an `error` (a reconnect) also refreshes once, to cover the gap.
- **`lib/live-refresh.ts`** — the pure scheduling logic, so it can be tested without React:
  `createRefreshScheduler({ refresh, windowMs = 1000 })` returning `{ request(), cancel() }`. The
  first `request()` refreshes after `windowMs`; further requests inside that window are absorbed, so
  a burst of events becomes one `router.refresh()`. `cancel()` drops a pending refresh (used on
  unmount and when the tab hides).

## 5. Failure behaviour

| Situation | What happens |
|---|---|
| Gateway or chat-service down | STOMP connect fails → stream closes → `EventSource` retries every 3s. Pages keep working; they refresh on navigation until the socket is back. |
| Access token expires mid-stream | chat-service's sweep closes the socket → stream closes → `EventSource` reconnects → middleware rotates the token on that request → new stream with the new token → one catch-up refresh. |
| Session fully expired | Middleware redirects instead of streaming → `EventSource` stops. The next navigation lands on `/login`. |
| Burst of events (e.g. a viral video's reports) | Coalesced into one refresh per ~1s window per tab. |

## 6. Testing

**Backend** (existing test classes where they exist, JUnit + Mockito as today):

- `submitReport` writes `ReportSubmittedEvent` for a new pending report; nothing for a repeat or an
  already-enforced target.
- `resolveReport` and `moderate` (answering action, including `DISMISS_REPORT`) write
  `ReportResolvedEvent`; `moderate` with `PURGE_VIDEO` does not.
- `OutboxPublisher` sends `REPORT` aggregates to `admin.report-events`, others to
  `admin.moderation-events`.
- `AdminFanout` sends a frame to `/topic/admin` with the header's event type, and the topic name
  when the header is missing.
- `StompSubscriptionInterceptorTest`: `/topic/admin` allowed for `ADMIN`, refused for `USER` and
  for a session with no role.

**Frontend:**

- `lib/live-refresh.check.mjs` (run with `node`, like `notifications.check.mjs`): a burst inside the
  window → one refresh; a request after the window → a second refresh; `cancel()` → no refresh.
- `npm run check` (lint, typecheck, build).

**End to end:** docker-compose stack + `next dev`; sign in as admin, file a report from
`tiktok-cloned`, and the bell badge and `/moderation/reports` update within ~1s without reloading.
If browser automation is unavailable, this is reported as not verified rather than claimed.

## Out of scope

- Toasts, sounds, browser notifications.
- Sharing one connection across tabs (`BroadcastChannel`/`SharedWorker`) — closing hidden tabs'
  streams already bounds connections.
- Refreshing only when the open page cares about the event type — every event refreshes the open
  page. ponytail: add a type→route filter if refresh load ever shows up.
- An event for `StaleReportSweep` closures, and a bell entry announcing an automatic trash purge
  (the purge itself still refreshes open pages through `VideoPurgedEvent`).
