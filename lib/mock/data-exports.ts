import type { DataExportSummaryResponse, FailedDataExport } from "@/lib/api/types";
import { MOCK_NOW } from "./random";
import { mockUsers } from "./users";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function failure(
  i: number,
  ago: number,
  fields: Pick<FailedDataExport, "format" | "categories">,
): FailedDataExport {
  return {
    id: String(7_386_000_000_000_000_000n + BigInt(i)),
    // From the mock directory, so a failure links to someone.
    userId: mockUsers[i * 3].id,
    attempts: 3,
    // Three leases of ten minutes between the request and giving up on it.
    requestedAt: new Date(MOCK_NOW - ago - 30 * MINUTE_MS).toISOString(),
    failedAt: new Date(MOCK_NOW - ago).toISOString(),
    ...fields,
  };
}

/**
 * The shapes the card has to show: work in flight, nothing stalled, and two failures — one asking
 * for everything, one for a single category.
 */
export const mockDataExportSummary: DataExportSummaryResponse = {
  processing: 2,
  oldestProcessingSince: new Date(MOCK_NOW - 4 * MINUTE_MS).toISOString(),
  stalled: 0,
  readyFiles: 14,
  failedSince: new Date(MOCK_NOW - 7 * DAY_MS).toISOString(),
  failed: 2,
  recentFailures: [
    failure(2, 5 * HOUR_MS, {
      format: "JSON",
      categories: ["DIRECT_MESSAGES"],
    }),
    failure(1, 2 * DAY_MS, {
      format: "TXT",
      categories: ["DIRECT_MESSAGES", "LIKES_AND_FAVORITES", "POSTS", "PROFILE_AND_SETTINGS", "YOUR_ACTIVITY"],
    }),
  ],
};
