import type { OutboxBacklogResponse, TextModerationStatusResponse } from "@/lib/api/types";

/** Every shape the card has to show: idle, draining, stuck, uncountable and unreachable. */
export const mockOutboxBacklogs: OutboxBacklogResponse[] = [
  {
    service: "admin-service",
    reachable: true,
    outboxes: [{ name: "outbox_events", pending: 0, oldestPendingAgeSeconds: 0 }],
  },
  {
    service: "auth-service",
    reachable: true,
    outboxes: [{ name: "outbox_events", pending: 2, oldestPendingAgeSeconds: 1.4 }],
  },
  { service: "story-service", reachable: false, outboxes: [] },
  {
    service: "user-service",
    reachable: true,
    outboxes: [{ name: "outbox_events", pending: null, oldestPendingAgeSeconds: null }],
  },
  {
    service: "video-service",
    reachable: true,
    outboxes: [
      { name: "published", pending: 41, oldestPendingAgeSeconds: 912 },
      { name: "deleted", pending: 0, oldestPendingAgeSeconds: 0 },
      { name: "visibility", pending: 0, oldestPendingAgeSeconds: 0 },
      { name: "purge", pending: 3, oldestPendingAgeSeconds: 48 },
      { name: "purge-request", pending: 0, oldestPendingAgeSeconds: 0 },
    ],
  },
];

/** One service measuring the rules before enforcing them, one from before the report existed. */
export const mockTextModerationStatus: TextModerationStatusResponse[] = [
  {
    service: "video-service",
    reachable: true,
    enforce: true,
    version: "rules-2026.10.2+admin-14",
    classifierEnabled: true,
    classifierEnforce: true,
  },
  {
    service: "interaction-service",
    reachable: true,
    enforce: false,
    version: "rules-2026.10.2+admin-14",
    classifierEnabled: true,
    classifierEnforce: false,
  },
  {
    service: "story-service",
    reachable: true,
    enforce: null,
    version: null,
    classifierEnabled: null,
    classifierEnforce: null,
  },
];
