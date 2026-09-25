# Admin Real-Time Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin console's 15-second polling with server push, so the open page and the topbar bell update within about a second of a report, moderation decision, verdict, or video trash/purge/publish.

**Architecture:** admin-service writes new report events to its outbox, routed to `admin.report-events`. chat-service's new `AdminFanout` relays a thin `{type}` frame for four topics to an admin-only STOMP destination, `/topic/admin`. The admin app's `/api/live` route holds one STOMP connection per visible tab, using the httpOnly session token server-side, and forwards frames as SSE. `LiveRefresh` in the browser turns each burst of frames into one `router.refresh()`.

**Tech Stack:** Spring Boot + Spring Kafka + Spring WebSocket/STOMP (Java, JUnit 5, Mockito, AssertJ) in `tiktok-backend`; Next.js 16.3 App Router, React, TypeScript, `@stomp/stompjs` ^7, Node 26 in `tiktok-admin`.

**Spec:** `docs/superpowers/specs/2026-09-25-admin-realtime-design.md` (in `tiktok-admin`)

## Global Constraints

- Two repos. Backend work happens in a **new git worktree** so the uncommitted work in `/Users/minhhung/Projects/EProject/EProject4/tiktok-backend` is never touched. Branch `feat/admin-realtime` from `fix/service-review-findings` (commit `5bea349`), because the code this plan edits exists only on that branch, not on `master`.
- Frontend work happens in `/Users/minhhung/Projects/EProject/EProject4/tiktok-admin` on the current branch `feat/admin-trash-activity-notifications`.
- Topic names, verbatim: `admin.report-events` (new), `admin.moderation-events`, `media.video-moderation-events`, `video.video-events`.
- STOMP destination: `/topic/admin`. Frame JSON: `{"type":"<eventType header, or topic name when absent>"}`. Nothing else goes in the frame.
- The report events never carry the report's reason text or the reporter's id.
- Outbox aggregate type for report events: `REPORT`. Moderation actions keep `MODERATION_ACTION`.
- admin-service outbox poll: property `admin.outbox.poll-millis`, value `500`.
- Role claim name `role`; the only admin value is `ADMIN` (exact, case-sensitive).
- SSE: `retry: 3000`, `: ping` comment every 25 000 ms, `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`. `USE_MOCK` → 204. No session → 401.
- Browser coalescing window: 1000 ms.
- Frontend rules (`FRONTEND_RULES.md`): TypeScript strict, no `any`, named exports, kebab-case file names, no comments restating what code does. Only `lib/api/client.ts` reads the session cookie or attaches the token. All backend traffic goes through the gateway (`GATEWAY_URL`), never a service port.
- Node's built-in `WebSocket` (Node 26) sends no `Origin` header; Spring's origin check lets a header-less handshake through, so no `WEBSOCKET_ALLOWED_ORIGINS` change is needed (verified during planning).
- Frontend checks: there is no `check` script. Run `npm run lint && npx tsc --noEmit && npm run build`, plus `node lib/*.check.mjs`.
- Backend test command shape (from the worktree root): `./mvnw -q -pl services/<svc> -am test -Dtest='<Classes>' -Dsurefire.failIfNoSpecifiedTests=false`.

## Review Focus

1. **Kafka partition split.** `AdminFanout` listens to three topics `VideoStateFanout` already consumes. In chat-service's shared consumer group, the two would split partitions and each would miss events. Public users would silently stop seeing takedowns and status changes. Pinned by the consumer-group test in Task 3.
2. **Non-admin or role-less socket subscribing to `/topic/admin`.** It must be refused, including a session with no role attribute at all and a lower-case `admin`. Pinned in Task 4.
3. **Report text leaking.** The reason text or reporter id must not reach Kafka or the socket, where every console subscriber would receive it. Pinned by the payload test in Task 1 and the frame shape in Task 3.
4. **Browser disconnects mid-stream** (tab closed or hidden). The route must stop the STOMP client and must not write to a closed stream (Node throws `ERR_INVALID_STATE`). Checked in Task 8, step 5, by watching the dev-server log while hiding and closing tabs.
5. **Upstream socket dies** (token expiry, chat-service restart). The stream must end and the browser must reconnect with a fresh token, then catch up with one refresh. Checked in Task 8, step 6, by restarting chat-service.

---

## File Structure

**tiktok-backend** (worktree `../tiktok-backend-admin-realtime`)

| File | Change | Responsibility |
|---|---|---|
| `libs/event-schema/src/main/java/com/tiktok/event/admin/ReportSubmittedEvent.java` | Create | A new pending report exists |
| `libs/event-schema/src/main/java/com/tiktok/event/admin/ReportResolvedEvent.java` | Create | Pending reports on a target were closed |
| `services/admin-service/.../event/producer/AdminEventProducer.java` | Modify | Writes report events to the outbox under aggregate `REPORT` |
| `services/admin-service/.../service/AdminServiceImpl.java` | Modify | Calls the producer on submit and on report closure |
| `services/admin-service/.../event/producer/OutboxPublisher.java` | Modify | Routes `REPORT` rows to `admin.report-events`; configurable poll |
| `services/admin-service/src/main/resources/application.yml` | Modify | `admin.outbox.poll-millis: 500` |
| `services/chat-service/.../realtime/AdminFrame.java` | Create | The `{type}` frame |
| `services/chat-service/.../realtime/AdminFanout.java` | Create | Kafka → `/topic/admin`, own consumer group |
| `services/chat-service/.../websocket/JwtHandshakeInterceptor.java` | Modify | Keeps the `role` claim as a session attribute |
| `services/chat-service/.../websocket/StompSubscriptionInterceptor.java` | Modify | `/topic/admin` for `ADMIN` only |

Tests: `AdminServiceImplTest` (modify), `AdminEventProducerTest`, `OutboxPublisherTest`, `AdminFanoutTest`, `JwtHandshakeInterceptorTest` (create), `StompSubscriptionInterceptorTest` (modify).

**tiktok-admin**

| File | Change | Responsibility |
|---|---|---|
| `lib/live-refresh.ts` | Create | Pure burst-coalescing scheduler |
| `lib/live-refresh.check.mjs` | Create | Its check |
| `lib/api/client.ts` | Modify | `gatewaySocketUrl()`, the only token reader for sockets |
| `lib/api/live.ts` | Create | One STOMP subscription to `/topic/admin`, no self-reconnect |
| `app/api/live/route.ts` | Create | SSE relay |
| `components/layout/live-refresh.tsx` | Create | `EventSource` lifecycle → scheduler → `router.refresh()` |
| `components/layout/auto-refresh.tsx` | Delete | Replaced |
| `app/(admin)/layout.tsx` | Modify | Renders `LiveRefresh` instead of `AutoRefresh` |
| `package.json`, `package-lock.json` | Modify | `@stomp/stompjs` |

Paths abbreviated with `...` expand to `src/main/java/com/tiktok/<servicepackage>/` (`adminservice` / `chatservice`). Test paths mirror them under `src/test/java/`.

---

### Task 1: admin-service announces filed and closed reports

**Files:**
- Create: `libs/event-schema/src/main/java/com/tiktok/event/admin/ReportSubmittedEvent.java`
- Create: `libs/event-schema/src/main/java/com/tiktok/event/admin/ReportResolvedEvent.java`
- Modify: `services/admin-service/src/main/java/com/tiktok/adminservice/event/producer/AdminEventProducer.java`
- Modify: `services/admin-service/src/main/java/com/tiktok/adminservice/service/AdminServiceImpl.java` (`submitReport` ~line 52-100, `resolveReport` ~line 135-166, `moderate` ~line 186-204)
- Create test: `services/admin-service/src/test/java/com/tiktok/adminservice/event/producer/AdminEventProducerTest.java`
- Modify test: `services/admin-service/src/test/java/com/tiktok/adminservice/service/AdminServiceImplTest.java`

**Interfaces:**
- Produces: `ReportSubmittedEvent.of(Long reportId, String targetType, String targetId)`, `ReportResolvedEvent.of(String targetType, String targetId)`; `AdminEventProducer.REPORT_AGGREGATE` (package-private `static final String`, `"REPORT"`); `AdminEventProducer#publishReportSubmitted(Report)`, `AdminEventProducer#publishReportsResolved(ReportTargetType, String)`. Task 2 reads `REPORT_AGGREGATE`.

- [ ] **Step 0: Create the backend worktree**

```bash
cd /Users/minhhung/Projects/EProject/EProject4/tiktok-backend
git worktree add ../tiktok-backend-admin-realtime -b feat/admin-realtime fix/service-review-findings
cp .env ../tiktok-backend-admin-realtime/.env
cd ../tiktok-backend-admin-realtime && git log --oneline -1
```
Expected: `5bea349 feat(chat): honour the recipient's DM audience when opening a conversation`. `.env` is gitignored config the Makefile reads; it is copied, never committed.

All remaining backend steps run from `/Users/minhhung/Projects/EProject/EProject4/tiktok-backend-admin-realtime`.

- [ ] **Step 1: Write the failing producer test**

Create `services/admin-service/src/test/java/com/tiktok/adminservice/event/producer/AdminEventProducerTest.java`:

```java
package com.tiktok.adminservice.event.producer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tiktok.adminservice.entity.ModerationAction;
import com.tiktok.adminservice.entity.ModerationActionType;
import com.tiktok.adminservice.entity.OutboxEvent;
import com.tiktok.adminservice.entity.Report;
import com.tiktok.adminservice.entity.ReportStatus;
import com.tiktok.adminservice.entity.ReportTargetType;
import com.tiktok.adminservice.repository.OutboxEventRepository;
import com.tiktok.event.admin.ReportResolvedEvent;
import com.tiktok.event.admin.ReportSubmittedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AdminEventProducerTest {

    @Mock
    private OutboxEventRepository outboxEventRepository;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private AdminEventProducer producer() {
        return new AdminEventProducer(outboxEventRepository, objectMapper);
    }

    private OutboxEvent saved() {
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void reportSubmitted_isWrittenUnderTheReportAggregate_withoutTheReportersWords() throws Exception {
        Report report = Report.builder()
                .id(7L)
                .reporterId(99L)
                .targetType(ReportTargetType.VIDEO)
                .targetId("v1")
                .reason("my neighbour posted this")
                .status(ReportStatus.PENDING)
                .build();

        producer().publishReportSubmitted(report);

        OutboxEvent row = saved();
        assertThat(row.getAggregateType()).isEqualTo(AdminEventProducer.REPORT_AGGREGATE);
        assertThat(row.getAggregateId()).isEqualTo("v1");
        assertThat(row.getEventType()).isEqualTo("ReportSubmittedEvent");
        ReportSubmittedEvent event = objectMapper.readValue(row.getPayload(), ReportSubmittedEvent.class);
        assertThat(event.reportId()).isEqualTo(7L);
        assertThat(event.targetType()).isEqualTo("VIDEO");
        assertThat(event.targetId()).isEqualTo("v1");
        // Every admin console receives this; the reporter's text and identity stay behind REST.
        assertThat(row.getPayload()).doesNotContain("neighbour").doesNotContain("99");
    }

    @Test
    void reportsResolved_isWrittenUnderTheReportAggregate() throws Exception {
        producer().publishReportsResolved(ReportTargetType.USER, "42");

        OutboxEvent row = saved();
        assertThat(row.getAggregateType()).isEqualTo(AdminEventProducer.REPORT_AGGREGATE);
        assertThat(row.getEventType()).isEqualTo("ReportResolvedEvent");
        ReportResolvedEvent event = objectMapper.readValue(row.getPayload(), ReportResolvedEvent.class);
        assertThat(event.targetType()).isEqualTo("USER");
        assertThat(event.targetId()).isEqualTo("42");
    }

    @Test
    void moderationActions_keepTheirOwnAggregate() {
        producer().publishFor(ModerationAction.builder()
                .adminId(2L)
                .actionType(ModerationActionType.TAKEDOWN_VIDEO)
                .targetType(ReportTargetType.VIDEO)
                .targetId("v1")
                .reason("policy violation")
                .build());

        assertThat(saved().getAggregateType()).isEqualTo("MODERATION_ACTION");
    }
}
```

- [ ] **Step 2: Add the service tests**

Append these tests inside `AdminServiceImplTest` (before the `standingAction` helper at the end of the class). The class already statically imports `any`, `eq`, `never`, `verify`, `when`, and `assertThat`.

```java
    @Test
    void submitReport_newPendingReport_isAnnouncedToTheConsole() {
        when(reportRepository.findByReporterIdAndTargetTypeAndTargetIdAndDeletedAtIsNull(
                10L, ReportTargetType.VIDEO, "v1")).thenReturn(Optional.empty());
        when(reportRepository.saveAndFlush(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));

        adminService.submitReport(10L, new SubmitReportRequest(ReportTargetType.VIDEO, "v1", "spam content"));

        ArgumentCaptor<Report> saved = ArgumentCaptor.forClass(Report.class);
        verify(reportRepository).saveAndFlush(saved.capture());
        verify(adminEventProducer).publishReportSubmitted(saved.getValue());
    }

    @Test
    void submitReport_repeatSubmission_announcesNothing() {
        Report standing = Report.builder()
                .id(3L)
                .reporterId(10L)
                .targetType(ReportTargetType.VIDEO)
                .targetId("v1")
                .reason("spam content")
                .status(ReportStatus.PENDING)
                .build();
        when(reportRepository.findByReporterIdAndTargetTypeAndTargetIdAndDeletedAtIsNull(
                10L, ReportTargetType.VIDEO, "v1")).thenReturn(Optional.of(standing));

        adminService.submitReport(10L, new SubmitReportRequest(ReportTargetType.VIDEO, "v1", "spam content"));

        verify(adminEventProducer, never()).publishReportSubmitted(any());
    }

    @Test
    void submitReport_targetAlreadyEnforced_announcesNothing() {
        when(reportRepository.findByReporterIdAndTargetTypeAndTargetIdAndDeletedAtIsNull(
                10L, ReportTargetType.VIDEO, "v1")).thenReturn(Optional.empty());
        standingAction(ModerationActionType.TAKEDOWN_VIDEO);
        when(reportRepository.saveAndFlush(any(Report.class))).thenAnswer(inv -> inv.getArgument(0));

        adminService.submitReport(10L, new SubmitReportRequest(ReportTargetType.VIDEO, "v1", "Nudity and sexual content"));

        // Closed on arrival: no admin will ever see it in the queue, so it is not news.
        verify(adminEventProducer, never()).publishReportSubmitted(any());
    }

    @Test
    void resolveReport_dismissAnnouncesTheClosedReports() {
        Report pending = Report.builder()
                .id(8L)
                .reporterId(1L)
                .targetType(ReportTargetType.VIDEO)
                .targetId("p1")
                .reason("false report")
                .status(ReportStatus.PENDING)
                .build();
        when(reportRepository.findByIdAndDeletedAtIsNull(8L)).thenReturn(Optional.of(pending));

        adminService.resolveReport(2L, 8L,
                new ResolveReportRequest(ModerationActionType.DISMISS_REPORT, "not a violation", null));

        // DISMISS_REPORT writes no moderation event, so without this another admin's bell keeps it.
        verify(adminEventProducer).publishReportsResolved(ReportTargetType.VIDEO, "p1");
    }

    @Test
    void moderate_answeringActionAnnouncesTheClosedReports() {
        adminService.moderate(2L, ReportTargetType.VIDEO, "v1", ModerationActionType.TAKEDOWN_VIDEO, "policy violation");

        verify(adminEventProducer).publishReportsResolved(ReportTargetType.VIDEO, "v1");
    }

    @Test
    void moderate_purgeAnnouncesNoReportChange() {
        adminService.moderate(2L, ReportTargetType.VIDEO, "v1", ModerationActionType.PURGE_VIDEO, "owner asked");

        verify(adminEventProducer, never()).publishReportsResolved(any(), any());
    }
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `./mvnw -q -pl services/admin-service -am test -Dtest='AdminEventProducerTest,AdminServiceImplTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: compilation FAILURE. `cannot find symbol` for `ReportSubmittedEvent`, `publishReportSubmitted`, `REPORT_AGGREGATE`.

- [ ] **Step 4: Create the two events**

`libs/event-schema/src/main/java/com/tiktok/event/admin/ReportSubmittedEvent.java`:

```java
package com.tiktok.event.admin;

import com.tiktok.event.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record ReportSubmittedEvent(
        String eventId,
        Instant occurredAt,
        Long reportId,
        String targetType,
        String targetId
) implements DomainEvent {

    public static ReportSubmittedEvent of(Long reportId, String targetType, String targetId) {
        return new ReportSubmittedEvent(UUID.randomUUID().toString(), Instant.now(), reportId, targetType, targetId);
    }
}
```

`libs/event-schema/src/main/java/com/tiktok/event/admin/ReportResolvedEvent.java`:

```java
package com.tiktok.event.admin;

import com.tiktok.event.DomainEvent;

import java.time.Instant;
import java.util.UUID;

public record ReportResolvedEvent(
        String eventId,
        Instant occurredAt,
        String targetType,
        String targetId
) implements DomainEvent {

    public static ReportResolvedEvent of(String targetType, String targetId) {
        return new ReportResolvedEvent(UUID.randomUUID().toString(), Instant.now(), targetType, targetId);
    }
}
```

- [ ] **Step 5: Extend `AdminEventProducer`**

In `AdminEventProducer.java`, add these imports:

```java
import com.tiktok.adminservice.entity.Report;
import com.tiktok.adminservice.entity.ReportTargetType;
import com.tiktok.event.admin.ReportResolvedEvent;
import com.tiktok.event.admin.ReportSubmittedEvent;
```

Replace the constant, `publishFor`, and `writeToOutbox` with the code below. `toEvent` stays unchanged.

```java
    private static final String AGGREGATE_TYPE = "MODERATION_ACTION";
    /** Read by OutboxPublisher to send these to admin.report-events instead. */
    static final String REPORT_AGGREGATE = "REPORT";

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public void publishFor(ModerationAction action) {
        DomainEvent event = toEvent(action);
        if (event == null) {
            return;
        }
        writeToOutbox(AGGREGATE_TYPE, action.getTargetId(), event);
    }

    public void publishReportSubmitted(Report report) {
        writeToOutbox(REPORT_AGGREGATE, report.getTargetId(),
                ReportSubmittedEvent.of(report.getId(), report.getTargetType().name(), report.getTargetId()));
    }

    public void publishReportsResolved(ReportTargetType targetType, String targetId) {
        writeToOutbox(REPORT_AGGREGATE, targetId, ReportResolvedEvent.of(targetType.name(), targetId));
    }
```

```java
    @SneakyThrows
    private void writeToOutbox(String aggregateType, String aggregateId, DomainEvent event) {
        OutboxEvent outboxEvent = OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(event.getClass().getSimpleName())
                .payload(objectMapper.writeValueAsString(event))
                .build();

        outboxEventRepository.save(outboxEvent);
    }
```

- [ ] **Step 6: Call the producer from `AdminServiceImpl`**

In `submitReport`, replace the `try { return adminMapper.toResponse(reportRepository.saveAndFlush(report)); } catch (...) {...}` block with this (the catch body is unchanged):

```java
        Report saved;
        try {
            // Flushed here so the unique index answers inside this method. Left to commit time it
            // would surface as a raw DataIntegrityViolationException from the transaction proxy
            // and be served as a 500.
            saved = reportRepository.saveAndFlush(report);
        } catch (DataIntegrityViolationException e) {
            // Lost the race with a concurrent submit of the same report. 409 rather than the
            // other request's row, because that row cannot be read from this transaction any more.
            // Only for that index: any other violation is a bug on our side, and calling it a
            // duplicate told the reporter their report was filed when nothing was.
            if (e.getCause() instanceof ConstraintViolationException cause
                    && "idx_reports_one_per_reporter_target".equalsIgnoreCase(cause.getConstraintName())) {
                throw new ReportAlreadySubmittedException();
            }
            throw e;
        }

        if (!alreadyEnforced) {
            adminEventProducer.publishReportSubmitted(saved);
        }
        return adminMapper.toResponse(saved);
```

In `resolveReport`, directly after the `reportRepository.closePendingFor(report.getTargetType(), ...);` statement, add:

```java
        adminEventProducer.publishReportsResolved(report.getTargetType(), report.getTargetId());
```

In `moderate(..., Integer banDays)`, inside `if (actionType.answersReports()) { ... }`, after the `closePendingFor` call, add:

```java
            adminEventProducer.publishReportsResolved(targetType, targetId);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `./mvnw -q -pl services/admin-service -am test -Dtest='AdminEventProducerTest,AdminServiceImplTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: BUILD SUCCESS, no failures. This includes every pre-existing `AdminServiceImplTest` test.

- [ ] **Step 8: Commit**

```bash
git add libs/event-schema/src/main/java/com/tiktok/event/admin/ReportSubmittedEvent.java \
  libs/event-schema/src/main/java/com/tiktok/event/admin/ReportResolvedEvent.java \
  services/admin-service/src/main/java/com/tiktok/adminservice/event/producer/AdminEventProducer.java \
  services/admin-service/src/main/java/com/tiktok/adminservice/service/AdminServiceImpl.java \
  services/admin-service/src/test/java/com/tiktok/adminservice/event/producer/AdminEventProducerTest.java \
  services/admin-service/src/test/java/com/tiktok/adminservice/service/AdminServiceImplTest.java
git commit -m "feat(admin): announce filed and closed reports through the outbox

The admin console is switching from polling to push, and nothing told it a
report had been filed, or dismissed: DISMISS_REPORT writes no moderation event.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Route report events to their own topic, poll faster

**Files:**
- Modify: `services/admin-service/src/main/java/com/tiktok/adminservice/event/producer/OutboxPublisher.java`
- Modify: `services/admin-service/src/main/resources/application.yml` (the `admin:` block, ~line 51)
- Create test: `services/admin-service/src/test/java/com/tiktok/adminservice/event/producer/OutboxPublisherTest.java`

**Interfaces:**
- Consumes: `AdminEventProducer.REPORT_AGGREGATE` (Task 1).
- Produces: records on Kafka topic `admin.report-events` with header `eventType` = `ReportSubmittedEvent` / `ReportResolvedEvent`. Task 3 listens to it.

- [ ] **Step 1: Write the failing test**

```java
package com.tiktok.adminservice.event.producer;

import com.tiktok.adminservice.entity.OutboxEvent;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OutboxPublisherTest {

    @Test
    void reportEventsGoToTheirOwnTopic() {
        OutboxEvent row = OutboxEvent.builder().aggregateType(AdminEventProducer.REPORT_AGGREGATE).build();

        assertThat(OutboxPublisher.topicFor(row)).isEqualTo("admin.report-events");
    }

    /** Six services consume admin.moderation-events; a report must not wake every one of them. */
    @Test
    void moderationActionsStayOnTheModerationTopic() {
        OutboxEvent row = OutboxEvent.builder().aggregateType("MODERATION_ACTION").build();

        assertThat(OutboxPublisher.topicFor(row)).isEqualTo("admin.moderation-events");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./mvnw -q -pl services/admin-service -am test -Dtest='OutboxPublisherTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: compilation FAILURE, `cannot find symbol: method topicFor`.

- [ ] **Step 3: Implement routing and the configurable poll**

In `OutboxPublisher.java`:

1. Replace the class Javadoc's first sentence ("admin.moderation-events mixes several event types …") with:

```java
/**
 * Report events go to admin.report-events, everything else to admin.moderation-events. Both mix
 * several event types with no type field in the JSON payload itself, so the eventType header is
 * the only way a consumer can tell them apart.
```

   (keep the `<p>Marking is delegated…` paragraph as is).

2. Replace `private static final String TOPIC = "admin.moderation-events";` with:

```java
    private static final String MODERATION_TOPIC = "admin.moderation-events";
    private static final String REPORT_TOPIC = "admin.report-events";
```

3. Replace `@Scheduled(fixedDelay = 5000)` with:

```java
    @Scheduled(fixedDelayString = "${admin.outbox.poll-millis}")
```

4. In `toRecord`, change `TOPIC` to `topicFor(event)`, and add below it:

```java
    static String topicFor(OutboxEvent event) {
        return AdminEventProducer.REPORT_AGGREGATE.equals(event.getAggregateType()) ? REPORT_TOPIC : MODERATION_TOPIC;
    }
```

In `application.yml`, add under the top-level `admin:` key (sibling of `retention:` and `stale-reports:`):

```yaml
  outbox:
    # The admin console refreshes when these reach it, so this is most of a new report's delay.
    # Cheap: the unpublished rows are a partial index (idx_outbox_events_unpublished).
    poll-millis: 500
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./mvnw -q -pl services/admin-service -am test -Dtest='OutboxPublisherTest,AdminEventProducerTest,AdminServiceImplTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Verify the service still starts with the new placeholder**

Run: `grep -rn 'poll-millis' services/admin-service/src` → expected: the `@Scheduled` line and the yml line. (Full start-up is exercised in Task 8.)

- [ ] **Step 6: Commit**

```bash
git add services/admin-service/src/main/java/com/tiktok/adminservice/event/producer/OutboxPublisher.java \
  services/admin-service/src/main/resources/application.yml \
  services/admin-service/src/test/java/com/tiktok/adminservice/event/producer/OutboxPublisherTest.java
git commit -m "feat(admin): send report events to admin.report-events and poll the outbox every 500ms

A separate topic keeps six moderation consumers from waking up for every report,
and a 5s poll was most of the delay before an admin saw a new report.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: chat-service relays admin-relevant events to `/topic/admin`

**Files:**
- Create: `services/chat-service/src/main/java/com/tiktok/chatservice/realtime/AdminFrame.java`
- Create: `services/chat-service/src/main/java/com/tiktok/chatservice/realtime/AdminFanout.java`
- Create test: `services/chat-service/src/test/java/com/tiktok/chatservice/realtime/AdminFanoutTest.java`

**Interfaces:**
- Consumes: topics `admin.report-events` (Task 2), `admin.moderation-events`, `media.video-moderation-events`, `video.video-events`.
- Produces: STOMP frames `{"type": String}` on `/topic/admin`. Task 4 gates subscription; Task 6 subscribes.

- [ ] **Step 1: Write the failing test**

```java
package com.tiktok.chatservice.realtime;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AdminFanoutTest {

    @Mock
    private SimpMessagingTemplate messaging;

    @Test
    void relaysTheEventTypeAndNothingElse() {
        ConsumerRecord<String, String> record = new ConsumerRecord<>(
                "admin.report-events", 0, 0L, "v1", "{\"reportId\":7,\"targetId\":\"v1\"}");
        record.headers().add("eventType", "ReportSubmittedEvent".getBytes(StandardCharsets.UTF_8));

        new AdminFanout(messaging).onEvent(record);

        verify(messaging).convertAndSend(AdminFanout.DESTINATION, new AdminFrame("ReportSubmittedEvent"));
    }

    /** media-worker's verdicts carry no eventType header. */
    @Test
    void fallsBackToTheTopicWhenTheProducerSetNoType() {
        ConsumerRecord<String, String> record = new ConsumerRecord<>(
                "media.video-moderation-events", 0, 0L, "v1", "{}");

        new AdminFanout(messaging).onEvent(record);

        verify(messaging).convertAndSend(AdminFanout.DESTINATION, new AdminFrame("media.video-moderation-events"));
    }

    /**
     * VideoStateFanout consumes three of the same topics. In the service-wide group the two
     * listeners would split those topics' partitions, and each would see only part of the stream.
     */
    @Test
    void consumesInItsOwnGroup() throws Exception {
        KafkaListener listener = AdminFanout.class
                .getMethod("onEvent", ConsumerRecord.class)
                .getAnnotation(KafkaListener.class);

        assertThat(listener.groupId()).startsWith("admin-realtime-");
        assertThat(listener.topics()).containsExactlyInAnyOrder(
                "admin.report-events", "admin.moderation-events",
                "media.video-moderation-events", "video.video-events");
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./mvnw -q -pl services/chat-service -am test -Dtest='AdminFanoutTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: compilation FAILURE, `cannot find symbol: class AdminFanout`.

- [ ] **Step 3: Implement**

`AdminFrame.java`:

```java
package com.tiktok.chatservice.realtime;

/** One message on {@code /topic/admin}. The console re-reads through REST, so this is all it needs. */
public record AdminFrame(String type) {
}
```

`AdminFanout.java`:

```java
package com.tiktok.chatservice.realtime;

import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * Tells every open admin console that something it lists may have changed. No payload is parsed or
 * forwarded: the console re-reads through REST, and a report's text has no business on a socket.
 *
 * <p>Its own consumer group, unlike the other fanouts: VideoStateFanout listens to three of these
 * topics, and two listeners in one group split a topic's partitions between them.
 */
@Component
@RequiredArgsConstructor
public class AdminFanout {

    static final String DESTINATION = "/topic/admin";

    private final SimpMessagingTemplate messaging;

    @KafkaListener(groupId = "admin-realtime-${random.uuid}", topics = {
            "admin.report-events",
            "admin.moderation-events",
            "media.video-moderation-events",
            "video.video-events"})
    public void onEvent(ConsumerRecord<String, String> record) {
        Header eventType = record.headers().lastHeader("eventType");
        String type = eventType == null
                ? record.topic()
                : new String(eventType.value(), StandardCharsets.UTF_8);
        messaging.convertAndSend(DESTINATION, new AdminFrame(type));
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./mvnw -q -pl services/chat-service -am test -Dtest='AdminFanoutTest,VideoStateFanoutTest,NotificationFanoutTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add services/chat-service/src/main/java/com/tiktok/chatservice/realtime/AdminFrame.java \
  services/chat-service/src/main/java/com/tiktok/chatservice/realtime/AdminFanout.java \
  services/chat-service/src/test/java/com/tiktok/chatservice/realtime/AdminFanoutTest.java
git commit -m "feat(chat): relay admin-relevant events to /topic/admin

The admin console replaces its 15s poll with a refresh on these frames. Its own
consumer group so it does not take partitions away from VideoStateFanout.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `/topic/admin` is for admins only

**Files:**
- Modify: `services/chat-service/src/main/java/com/tiktok/chatservice/websocket/JwtHandshakeInterceptor.java`
- Modify: `services/chat-service/src/main/java/com/tiktok/chatservice/websocket/StompSubscriptionInterceptor.java`
- Create test: `services/chat-service/src/test/java/com/tiktok/chatservice/websocket/JwtHandshakeInterceptorTest.java`
- Modify test: `services/chat-service/src/test/java/com/tiktok/chatservice/websocket/StompSubscriptionInterceptorTest.java`

**Interfaces:**
- Produces: `JwtHandshakeInterceptor.ROLE_ATTRIBUTE` (package-private `static final String`, `"role"`). The STOMP session attribute holds the token's `role` claim as a String.

- [ ] **Step 1: Write the failing handshake test**

```java
package com.tiktok.chatservice.websocket;

import com.tiktok.crypto.jwt.JwtProvider;
import com.tiktok.security.jwt.RevokedTokenChecker;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class JwtHandshakeInterceptorTest {

    private final JwtProvider jwtProvider = new JwtProvider("change-this-secret-in-production-please-0123456789");

    @Mock
    private RevokedTokenChecker revokedTokenChecker;

    private Map<String, Object> handshakeWith(Map<String, Object> claims) {
        Map<String, Object> all = new HashMap<>(claims);
        all.put(JwtProvider.CLAIM_TOKEN_TYPE, JwtProvider.TOKEN_TYPE_ACCESS);
        String token = jwtProvider.generateToken("42", all, 60_000);

        MockHttpServletRequest servlet = new MockHttpServletRequest("GET", "/ws");
        servlet.setQueryString("token=" + token);
        Map<String, Object> attributes = new HashMap<>();

        boolean accepted = new JwtHandshakeInterceptor(jwtProvider, revokedTokenChecker).beforeHandshake(
                new ServletServerHttpRequest(servlet),
                new ServletServerHttpResponse(new MockHttpServletResponse()),
                null, attributes);

        assertThat(accepted).isTrue();
        return attributes;
    }

    @Test
    void keepsTheRoleForTheSubscriptionCheck() {
        assertThat(handshakeWith(Map.of("role", "ADMIN")))
                .containsEntry(JwtHandshakeInterceptor.ROLE_ATTRIBUTE, "ADMIN")
                .containsEntry(JwtHandshakeInterceptor.USER_ID_ATTRIBUTE, "42");
    }

    @Test
    void aTokenWithoutARoleLeavesNone() {
        assertThat(handshakeWith(Map.of())).doesNotContainKey(JwtHandshakeInterceptor.ROLE_ATTRIBUTE);
    }
}
```

- [ ] **Step 2: Add the failing subscription tests**

In `StompSubscriptionInterceptorTest`:

1. Add imports:

```java
import org.junit.jupiter.params.provider.NullSource;

import java.util.HashMap;
import java.util.Map;
```

2. In the `@ValueSource` list of `rejectsSendOutsideApplicationPrefix`, add `"/topic/admin",` after `"/topic/feed",`. A client must not be able to forge admin frames.

3. Add a helper next to `subscribeTo`:

```java
    private Message<byte[]> subscribeAs(String destination, String role) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setUser((Principal) () -> "42");
        Map<String, Object> session = new HashMap<>();
        if (role != null) {
            session.put(JwtHandshakeInterceptor.ROLE_ATTRIBUTE, role);
        }
        accessor.setSessionAttributes(session);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
```

4. Add the tests:

```java
    @Test
    void adminTopicIsOpenToAdmins() {
        StompSubscriptionInterceptor interceptor = new StompSubscriptionInterceptor(conversationService);

        Message<byte[]> message = subscribeAs("/topic/admin", "ADMIN");

        assertThat(interceptor.preSend(message, null)).isSameAs(message);
        verifyNoInteractions(conversationService);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"USER", "admin", ""})
    void adminTopicIsRefusedToEveryoneElse(String role) {
        StompSubscriptionInterceptor interceptor = new StompSubscriptionInterceptor(conversationService);

        assertThatThrownBy(() -> interceptor.preSend(subscribeAs("/topic/admin", role), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** A session with no attributes at all — the shape every existing test here builds. */
    @Test
    void adminTopicIsRefusedWithoutSessionAttributes() {
        StompSubscriptionInterceptor interceptor = new StompSubscriptionInterceptor(conversationService);

        assertThatThrownBy(() -> interceptor.preSend(subscribeTo("/topic/admin"), null))
                .isInstanceOf(IllegalArgumentException.class);
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `./mvnw -q -pl services/chat-service -am test -Dtest='JwtHandshakeInterceptorTest,StompSubscriptionInterceptorTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: compilation FAILURE, `cannot find symbol: variable ROLE_ATTRIBUTE`.

- [ ] **Step 4: Keep the role at handshake**

In `JwtHandshakeInterceptor`, next to the other attribute constants, add:

```java
    static final String ROLE_ATTRIBUTE = "role";
    private static final String ROLE_CLAIM = "role";
```

After `attributes.put(TOKEN_ATTRIBUTE, token);`, add:

```java
        Object role = jwtProvider.extractClaims(token).get(ROLE_CLAIM);
        if (role != null) {
            attributes.put(ROLE_ATTRIBUTE, role.toString());
        }
```

- [ ] **Step 5: Gate the destination**

In `StompSubscriptionInterceptor`:

1. Add `import java.util.Map;`.
2. Add the constant under `APPLICATION_PREFIX`:

```java
    private static final String ADMIN_TOPIC = "/topic/admin";
```

3. In `preSend`, directly after the `PUBLIC_DESTINATIONS` check returns, add:

```java
        if (ADMIN_TOPIC.equals(destination)) {
            Map<String, Object> session = accessor.getSessionAttributes();
            if (session == null || !"ADMIN".equals(session.get(JwtHandshakeInterceptor.ROLE_ATTRIBUTE))) {
                log.warn("Refused non-admin subscription to {}", destination);
                throw new IllegalArgumentException("Subscription to " + destination + " is not allowed");
            }
            return message;
        }
```

4. Add one line to the class Javadoc's last paragraph: `{@code /topic/admin} is the one role-gated destination: the handshake keeps the token's role, and only {@code ADMIN} may subscribe.`

- [ ] **Step 6: Run the chat-service suite to verify**

Run: `./mvnw -q -pl services/chat-service -am test -Dtest='JwtHandshakeInterceptorTest,StompSubscriptionInterceptorTest,AdminFanoutTest,ChatWebSocketControllerTest' -Dsurefire.failIfNoSpecifiedTests=false`
Expected: BUILD SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add services/chat-service/src/main/java/com/tiktok/chatservice/websocket/JwtHandshakeInterceptor.java \
  services/chat-service/src/main/java/com/tiktok/chatservice/websocket/StompSubscriptionInterceptor.java \
  services/chat-service/src/test/java/com/tiktok/chatservice/websocket/JwtHandshakeInterceptorTest.java \
  services/chat-service/src/test/java/com/tiktok/chatservice/websocket/StompSubscriptionInterceptorTest.java
git commit -m "feat(chat): allow only ADMIN sessions to subscribe to /topic/admin

Admin frames reveal moderation activity; any signed-in user can open this socket.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Burst-coalescing refresh scheduler (tiktok-admin)

All frontend steps run from `/Users/minhhung/Projects/EProject/EProject4/tiktok-admin`.

**Files:**
- Create: `lib/live-refresh.ts`
- Create: `lib/live-refresh.check.mjs`

**Interfaces:**
- Produces: `createRefreshScheduler({ refresh: () => void; windowMs?: number }): { request(): void; cancel(): void }`. Task 7 uses it.

- [ ] **Step 1: Write the failing check**

`lib/live-refresh.check.mjs`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node lib/live-refresh.check.mjs`
Expected: FAIL, `ERR_MODULE_NOT_FOUND` for `./live-refresh.ts`.

- [ ] **Step 3: Implement**

`lib/live-refresh.ts`:

```ts
/** The first request opens a window; everything inside it becomes the one refresh at its end. */
export function createRefreshScheduler({
  refresh,
  windowMs = 1000,
}: {
  refresh: () => void;
  windowMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    request() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, windowMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node lib/live-refresh.check.mjs && node lib/notifications.check.mjs`
Expected: `live-refresh.check: ok`, and the notifications check passes as before.

- [ ] **Step 5: Commit**

```bash
git add lib/live-refresh.ts lib/live-refresh.check.mjs
git commit -m "feat(layout): add a scheduler that turns a burst of change signals into one refresh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `/api/live` relays the admin socket as SSE

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Modify: `lib/api/client.ts` (append after `apiPostAnonymous`)
- Create: `lib/api/live.ts`
- Create: `app/api/live/route.ts`

**Interfaces:**
- Consumes: STOMP `/topic/admin` frames `{"type": string}` (Tasks 3–4) through the gateway's `/ws`.
- Produces: `gatewaySocketUrl(): Promise<string | null>`; `subscribeAdminLive(brokerURL: string, handlers: { onFrame: (body: string) => void; onClose: () => void }): () => void`; `GET /api/live`, which returns `text/event-stream` with one `data: {"type":…}` line per frame. Task 7's `LiveRefresh` connects to `/api/live`.

Read first: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, sections "Streaming" and "Segment Config Options". GET handlers are dynamic by default in this version; `dynamic = "force-dynamic"` is kept explicit.

- [ ] **Step 1: Add the dependency**

Run: `npm install @stomp/stompjs@^7`
Expected: `package.json` gains `"@stomp/stompjs": "^7.x"`.

- [ ] **Step 2: Add `gatewaySocketUrl` to the client**

Append to `lib/api/client.ts`:

```ts
/** The gateway's STOMP endpoint. A socket handshake cannot carry a header, so the token goes in the URL. */
export async function gatewaySocketUrl(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const url = new URL(`${GATEWAY_URL}/ws`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  return url.toString();
}
```

- [ ] **Step 3: Create `lib/api/live.ts`**

```ts
import "server-only";

import { Client } from "@stomp/stompjs";

const ADMIN_TOPIC = "/topic/admin";

/**
 * Never reconnects on its own: the browser's EventSource reconnect goes back through the
 * middleware, which is what rotates an expired token.
 */
export function subscribeAdminLive(
  brokerURL: string,
  { onFrame, onClose }: { onFrame: (body: string) => void; onClose: () => void },
): () => void {
  let closed = false;
  const client = new Client({
    brokerURL,
    reconnectDelay: 0,
    onConnect: () => {
      client.subscribe(ADMIN_TOPIC, (message) => onFrame(message.body));
    },
    onStompError: () => {
      void client.deactivate();
    },
    onWebSocketClose: () => {
      if (closed) return;
      closed = true;
      onClose();
    },
  });
  client.activate();

  return () => {
    closed = true;
    void client.deactivate();
  };
}
```

- [ ] **Step 4: Create `app/api/live/route.ts`**

```ts
import { gatewaySocketUrl } from "@/lib/api/client";
import { USE_MOCK } from "@/lib/api/config";
import { subscribeAdminLive } from "@/lib/api/live";

export const dynamic = "force-dynamic";

const PING_MS = 25_000;
const encoder = new TextEncoder();

export async function GET(request: Request) {
  // 204 is the one answer that makes EventSource stop retrying.
  if (USE_MOCK) return new Response(null, { status: 204 });

  const brokerURL = await gatewaySocketUrl();
  if (!brokerURL) return new Response(null, { status: 401 });

  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let done = false;
      const write = (chunk: string) => {
        if (!done) controller.enqueue(encoder.encode(chunk));
      };
      const ping = setInterval(() => write(": ping\n\n"), PING_MS);
      const unsubscribe = subscribeAdminLive(brokerURL, {
        onFrame: (body) => write(`data: ${body.replace(/\r?\n/g, " ")}\n\n`),
        onClose: () => {
          if (done) return;
          stop();
          controller.close();
        },
      });
      stop = () => {
        if (done) return;
        done = true;
        clearInterval(ping);
        unsubscribe();
      };
      request.signal.addEventListener("abort", stop);
      write("retry: 3000\n\n");
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Smoke-test the mock branch**

Run in one terminal: `npx next dev -p 3100`. In another:
`curl -s -o /dev/null -w '%{http_code}\n' -b 'admin_session=x' http://localhost:3100/api/live`
Expected: `204` (mock mode is the default; the middleware only checks that the cookie exists). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/api/client.ts lib/api/live.ts app/api/live/route.ts
git commit -m "feat(layout): relay the admin socket to the browser as server-sent events

The access token is an httpOnly cookie, so the browser cannot open the socket
itself; the relay uses it server-side and never hands it to page scripts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `LiveRefresh` replaces `AutoRefresh`

**Files:**
- Create: `components/layout/live-refresh.tsx`
- Delete: `components/layout/auto-refresh.tsx`
- Modify: `app/(admin)/layout.tsx:2,30-31`

**Interfaces:**
- Consumes: `createRefreshScheduler` (Task 5), `GET /api/live` (Task 6).
- Produces: `LiveRefresh` (named export, no props).

- [ ] **Step 1: Create the component**

`components/layout/live-refresh.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRefreshScheduler } from "@/lib/live-refresh";

/**
 * Re-renders the current page when the backend says something changed. Only a visible tab holds a
 * stream: hidden tabs would otherwise use up the browser's six connections per origin, and the
 * refresh on return catches up on anything missed, including the trash expiry warning, which is a
 * date passing rather than an event.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const scheduler = createRefreshScheduler({ refresh: () => router.refresh() });
    let source: EventSource | null = null;

    const connect = () => {
      let dropped = false;
      source = new EventSource("/api/live");
      source.onmessage = () => scheduler.request();
      source.onerror = () => {
        dropped = true;
      };
      source.onopen = () => {
        if (!dropped) return;
        dropped = false;
        scheduler.request();
      };
    };

    const disconnect = () => {
      source?.close();
      source = null;
      scheduler.cancel();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        disconnect();
        return;
      }
      if (source && source.readyState !== EventSource.CLOSED) return;
      connect();
      router.refresh();
    };

    if (document.visibilityState === "visible") connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      disconnect();
    };
  }, [router]);

  return null;
}
```

- [ ] **Step 2: Swap it into the layout and delete `AutoRefresh`**

In `app/(admin)/layout.tsx`, replace
`import { AutoRefresh } from "@/components/layout/auto-refresh";`
with
`import { LiveRefresh } from "@/components/layout/live-refresh";`
and replace
```tsx
        {/* Live data only: mock pages have nothing to re-fetch. */}
        {USE_MOCK ? null : <AutoRefresh />}
```
with
```tsx
        {/* Live data only: mock pages have nothing to re-fetch. */}
        {USE_MOCK ? null : <LiveRefresh />}
```

Run: `git rm components/layout/auto-refresh.tsx`

- [ ] **Step 3: Verify nothing still references the old component**

Run: `grep -rn "auto-refresh\|AutoRefresh" app components lib`
Expected: no output.

- [ ] **Step 4: Full frontend checks**

Run: `npm run lint && npx tsc --noEmit && npm run build && node lib/live-refresh.check.mjs && node lib/notifications.check.mjs`
Expected: all succeed; the build lists `ƒ /api/live` as a dynamic route.

- [ ] **Step 5: Commit**

```bash
git add components/layout/live-refresh.tsx "app/(admin)/layout.tsx"
git commit -m "feat(layout): refresh admin pages on pushed changes instead of every 15s

Pages now update about a second after something happens, and stop re-rendering
every 15s when nothing has.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end verification

No new code. This proves the pieces fit and covers Review Focus items 4 and 5. If browser automation is unavailable, report which steps were verified by hand and which were not, rather than claiming success.

- [ ] **Step 1: Full backend test run for the touched services**

From the backend worktree: `./mvnw -q -pl services/admin-service,services/chat-service -am test -Dtest='!ReportQueueRepositoryTest,!ConversationConcurrencyTest' -Dsurefire.failIfNoSpecifiedTests=false`
(These two excluded tests are Testcontainers tests. Include them if Docker is running.)
Expected: BUILD SUCCESS.

- [ ] **Step 2: Start the stack from the worktree**

```bash
cd /Users/minhhung/Projects/EProject/EProject4/tiktok-backend-admin-realtime
./mvnw -q clean install -DskipTests
make infra-up
make run-gateway   # and in separate terminals: run-auth, run-user, run-video, run-media,
make run-admin     # run-chat, run-notification, run-analytics
make run-chat
```
Expected: admin-service logs no `Could not resolve placeholder 'admin.outbox.poll-millis'`, and chat-service logs a consumer group starting with `admin-realtime-`.

- [ ] **Step 3: Start both frontends against the live stack**

`tiktok-admin`: `ADMIN_USE_MOCK=false npx next dev -p 3100`. `tiktok-cloned`: `npm run dev` (port 3000). Sign in to the admin console as an admin.
Expected: DevTools → Network shows `/api/live` pending with type `eventsource`, and a `: ping` arrives within 25s.

- [ ] **Step 4: The golden path**

In `tiktok-cloned`, sign in as a normal user and report a video. Watch the admin tab without touching it.
Expected: within ~2s, a `data: {"type":"ReportSubmittedEvent"}` message appears on `/api/live`, the bell badge increments, and `/moderation/reports` (if open) lists the report, with no reload. In a second admin window, dismiss it. The first window's bell drops it within ~2s (`ReportResolvedEvent`).

- [ ] **Step 5: Tab hide / close (Review Focus 4)**

Switch to another browser tab for 10s, then back. Then close the admin tab.
Expected: while hidden, `/api/live` is closed. On return, a new `/api/live` request opens and the page refreshes once. After closing, the `next dev` terminal shows no `ERR_INVALID_STATE` or unhandled error, and chat-service logs the socket closing.

- [ ] **Step 6: Upstream drop (Review Focus 5)**

With the admin tab visible, stop chat-service (Ctrl-C on `make run-chat`), wait 10s, then start it again.
Expected: the stream ends, `EventSource` retries every ~3s, and once chat-service is up a new stream opens and the page refreshes once. Filing another report afterwards updates the bell again.

- [ ] **Step 7: Report**

Summarise in chat which steps passed, which were not run and why, and any deviation. Ask before pushing either branch or opening PRs, and before removing the backend worktree.
