import type { DataExportCategory, DataExportSummaryResponse } from "@/lib/api/types";

/** As the owner's checkboxes name them. */
export const DATA_EXPORT_CATEGORY_LABELS: Record<DataExportCategory, string> = {
  DIRECT_MESSAGES: "Direct Messages",
  LIKES_AND_FAVORITES: "Likes and Favorites",
  POSTS: "Posts",
  PROFILE_AND_SETTINGS: "Profile and Settings",
  YOUR_ACTIVITY: "Your Activity",
};

const CATEGORY_COUNT = Object.keys(DATA_EXPORT_CATEGORY_LABELS).length;

/** "All data", or the categories asked for — which says what the build had to read. */
export function dataExportScope(categories: DataExportCategory[]): string {
  if (new Set(categories).size === CATEGORY_COUNT) return "All data";
  return categories.map((category) => DATA_EXPORT_CATEGORY_LABELS[category]).join(", ");
}

export type DataExportHealth = { tone: "ok" | "warn" | "bad"; text: string };

/**
 * One line for the card's header. Stalled first: nothing is being built at all, and every new
 * request joins the queue. Failures next: the worker runs, but something it reads from does not.
 */
export function dataExportHealth(
  summary: Pick<DataExportSummaryResponse, "stalled" | "failed">,
): DataExportHealth {
  if (summary.stalled > 0) {
    return {
      tone: "bad",
      text: `${summary.stalled} ${summary.stalled === 1 ? "request has" : "requests have"} waited past every retry — check that user-service's worker is running.`,
    };
  }
  if (summary.failed > 0) {
    return {
      tone: "warn",
      text: `${summary.failed} ${summary.failed === 1 ? "request" : "requests"} failed in the last 7 days — usually video, interaction or chat-service was unreachable.`,
    };
  }
  return { tone: "ok", text: "Running normally." };
}
