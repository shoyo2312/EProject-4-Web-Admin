import "server-only";

import { apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import type {
  DeadLetterBatchReplayResponse,
  DeadLetterRecordsResponse,
  DeadLetterReplayResponse,
  DeadLetterTopicResponse,
} from "./types";
import { mockDeadLetterRecords, mockDeadLetterTopics } from "@/lib/mock/dead-letters";

/*
 * Kafka's dead-letter topics, read and replayed through admin-service — the same order check as
 * `make dlt-replay`, but with the broker's password, so it is the way to do it on production. A
 * replay sends the record back to the topic it failed on; every consumer there gets it again and
 * the ones that already handled it drop it on its eventId.
 */

const BASE = "/api/v1/admin/system/dead-letters";

const LIVE_ONLY =
  "Replaying requires the live backend (ADMIN_USE_MOCK=false) — the records are on Kafka, and admin-service sends them back.";

export async function listDeadLetterTopics(): Promise<DeadLetterTopicResponse[]> {
  if (USE_MOCK) return mockDeadLetterTopics;
  return apiGet<DeadLetterTopicResponse[]>(BASE);
}

/** 404 DEAD_LETTER_TOPIC_NOT_FOUND when the broker has no such topic. */
export async function getDeadLetters(topic: string, limit = 50): Promise<DeadLetterRecordsResponse> {
  if (USE_MOCK) {
    const records = mockDeadLetterRecords(topic);
    if (!records) throw new Error(`No dead-letter topic ${topic} in the mock data.`);
    return records;
  }
  return apiGet<DeadLetterRecordsResponse>(`${BASE}/${encodeURIComponent(topic)}?limit=${limit}`);
}

/** 404 DEAD_LETTER_NOT_FOUND when retention dropped it, or it was never there. */
export async function replayDeadLetter(
  topic: string,
  partition: number,
  offset: number,
  force: boolean,
): Promise<DeadLetterReplayResponse> {
  if (USE_MOCK) throw new Error(LIVE_ONLY);
  return apiPost<DeadLetterReplayResponse>(`${BASE}/${encodeURIComponent(topic)}/replay`, {
    partition,
    offset,
    force,
  });
}

export async function replayPendingDeadLetters(topic: string): Promise<DeadLetterBatchReplayResponse> {
  if (USE_MOCK) throw new Error(LIVE_ONLY);
  return apiPost<DeadLetterBatchReplayResponse>(`${BASE}/${encodeURIComponent(topic)}/replay-pending`);
}
