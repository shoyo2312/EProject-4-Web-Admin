import type { ReportTargetType } from "@/lib/api/types";
import { plural } from "@/lib/format";

/** A table page is 25 rows; a request for more than two pages' worth is not one a table made. */
export const BULK_MAX = 50;

export interface BulkOutcome {
  done: number;
  failed: { id: string; message: string }[];
}

/** Refusals that apply to every call alike — signed out, not allowed, rate-limited. */
const STOP_STATUSES = new Set([401, 403, 429]);

function stopsTheRun(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error ? error.status : null;
  return typeof status === "number" && STOP_STATUSES.has(status);
}

/**
 * One call per item, one at a time: every server-side call this console makes shares the gateway's
 * rate limit, and a burst of fifty would spend it for every other page. A refusal that would repeat
 * for every item stops the run, and the items not tried are counted as failed with it.
 * ponytail: sequential per-item calls; a bulk endpoint in admin-service once pages of 50 feel slow.
 */
export async function runEach<T>(
  items: readonly T[],
  run: (item: T) => Promise<unknown>,
  idOf: (item: T) => string = String,
): Promise<BulkOutcome> {
  const failed: BulkOutcome["failed"] = [];
  for (const [index, item] of items.entries()) {
    try {
      await run(item);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (stopsTheRun(error)) {
        for (const rest of items.slice(index)) failed.push({ id: idOf(rest), message });
        break;
      }
      failed.push({ id: idOf(item), message });
    }
  }
  return { done: items.length - failed.length, failed };
}

export function bulkSummary(outcome: BulkOutcome, verb: string, noun: string): string {
  const total = outcome.done + outcome.failed.length;
  if (outcome.failed.length === 0) return `${verb} ${total} ${plural(total, noun)}.`;
  const reason = outcome.failed[0].message.replace(/\.$/, "");
  return `${verb} ${outcome.done} of ${total} ${plural(total, noun)}. ${outcome.failed.length} failed: ${reason}.`;
}

const PLAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** What a bulk server action was sent, if it is 1 to BULK_MAX plain ids — they go into a path. Repeats collapse. */
export function plainIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > BULK_MAX) return null;
  return value.every((id): id is string => typeof id === "string" && PLAIN_ID.test(id))
    ? [...new Set(value)]
    : null;
}

/** admin-service's own limit, checked once here rather than refused by every call in the run. */
const REASON_MAX = 1000;

/** The reason trimmed, if it is one admin-service will take. */
export function cleanReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length > 0 && reason.length <= REASON_MAX ? reason : null;
}

export interface QueueTarget {
  targetType: ReportTargetType;
  targetId: string;
}

const TARGET_TYPES: readonly string[] = ["USER", "VIDEO", "COMMENT"] satisfies ReportTargetType[];

/** Queue rows for a bulk decision, if every one names a known kind of target. */
export function queueTargets(value: unknown): QueueTarget[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > BULK_MAX) return null;
  const targets = value.map((item): QueueTarget | null => {
    if (typeof item !== "object" || item === null) return null;
    const { targetType, targetId } = item as Record<string, unknown>;
    return typeof targetType === "string"
      && TARGET_TYPES.includes(targetType)
      && typeof targetId === "string"
      && targetId.length > 0
      && targetId.length <= 129
      ? { targetType: targetType as ReportTargetType, targetId }
      : null;
  });
  return targets.every((target): target is QueueTarget => target !== null) ? targets : null;
}
