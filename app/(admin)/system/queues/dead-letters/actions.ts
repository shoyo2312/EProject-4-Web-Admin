"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { replayDeadLetter, replayPendingDeadLetters } from "@/lib/api/dead-letters";
import { batchReplaySummary, replayOutcomeText } from "@/lib/dead-letters";
import type { ModerationResult } from "@/lib/moderation";

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "DEAD_LETTER_NOT_FOUND") {
      return "The record is no longer on the topic — retention has dropped it.";
    }
    if (error.code === "KAFKA_UNAVAILABLE") {
      return "Kafka did not answer in time. Whatever was replayed before that is recorded; try again.";
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function refresh() {
  revalidatePath("/system/queues");
  revalidatePath("/system/queues/dead-letters");
}

/**
 * Whatever admin-service answered is a success here, held back included: it is recorded either
 * way, and the row then shows why and offers the forced replay.
 */
export async function replayDeadLetterAction(
  topic: string,
  partition: number,
  offset: number,
  force: boolean,
): Promise<ModerationResult> {
  try {
    const result = await replayDeadLetter(topic, partition, offset, force);
    refresh();
    return { ok: true, message: replayOutcomeText(result) };
  } catch (error) {
    refresh();
    return { ok: false, message: failureMessage(error) };
  }
}

export async function replayPendingAction(topic: string): Promise<ModerationResult> {
  try {
    const response = await replayPendingDeadLetters(topic);
    refresh();
    return { ok: true, message: batchReplaySummary(response) };
  } catch (error) {
    refresh();
    return { ok: false, message: failureMessage(error) };
  }
}
