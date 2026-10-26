import type {
  DeadLetterRecordResponse,
  DeadLetterRecordsResponse,
  DeadLetterTopicResponse,
} from "@/lib/api/types";
import { MOCK_NOW } from "./random";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function ago(ms: number): string {
  return new Date(MOCK_NOW - ms).toISOString();
}

/**
 * The shapes the screen has to show: a topic with work waiting, one an earlier bulk replay went
 * through, and one record held back by a later event under its key.
 */
const RECORDS: Record<string, DeadLetterRecordResponse[]> = {
  "video.video-events.DLT": [
    {
      partition: 2,
      offset: 14,
      parkedAt: ago(35 * MINUTE_MS),
      key: "7386123000000000412",
      eventType: "VideoDeletedEvent",
      origin: "video.video-events-2@90412",
      consumerGroup: "search-service",
      error: "java.lang.IllegalStateException: owner_bans row 7386123000000000097 has no changedAt",
      pending: true,
      lastReplay: null,
    },
    {
      partition: 0,
      offset: 9,
      parkedAt: ago(3 * HOUR_MS),
      key: "7386123000000000388",
      eventType: "VideoPublishedEvent",
      origin: "video.video-events-0@88120",
      consumerGroup: "recommendation-service",
      error: "tools.jackson.databind.exc.MismatchedInputException: Cannot map `null` into type `long`",
      pending: true,
      lastReplay: {
        outcome: "HELD_BACK",
        detail: "video.video-events-0@88131 holds a later VideoDeletedEvent for key 7386123000000000388",
        forced: false,
        adminId: "7250000000000000001",
        at: ago(2 * HOUR_MS),
      },
    },
    {
      partition: 0,
      offset: 8,
      parkedAt: ago(3 * HOUR_MS + 4 * MINUTE_MS),
      key: "7386123000000000371",
      eventType: "VideoPublishedEvent",
      origin: "video.video-events-0@88102",
      consumerGroup: "recommendation-service",
      error: "tools.jackson.databind.exc.MismatchedInputException: Cannot map `null` into type `long`",
      pending: false,
      lastReplay: {
        outcome: "REPLAYED",
        detail: "video.video-events-0@88140",
        forced: false,
        adminId: "7250000000000000001",
        at: ago(2 * HOUR_MS),
      },
    },
  ],
  "interaction.comment-events.DLT": [
    {
      partition: 1,
      offset: 3,
      parkedAt: ago(6 * DAY_MS),
      key: "7386119000000000052",
      eventType: null,
      origin: "interaction.comment-events-1@4410",
      consumerGroup: "notification-service",
      error: "java.lang.IllegalArgumentException: No enum constant NotificationType.MENTION_REPLY",
      pending: false,
      lastReplay: null,
    },
  ],
};

function describe(topic: string): DeadLetterTopicResponse {
  const records = RECORDS[topic];
  return {
    topic,
    originTopic: topic.slice(0, -".DLT".length),
    retained: records.length,
    pending: records.filter((record) => record.pending).length,
    latestAt: records.reduce<string | null>(
      (latest, record) => (latest === null || record.parkedAt > latest ? record.parkedAt : latest),
      null,
    ),
  };
}

export const mockDeadLetterTopics: DeadLetterTopicResponse[] = Object.keys(RECORDS).sort().map(describe);

export function mockDeadLetterRecords(topic: string): DeadLetterRecordsResponse | null {
  if (!(topic in RECORDS)) return null;
  return { topic: describe(topic), records: RECORDS[topic] };
}
