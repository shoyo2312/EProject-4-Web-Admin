import type { ReportEvidenceItem, ReportResponse } from "./api/types.ts";

/** Where a report was filed from. Reports older than the field have no `source` and are profile reports. */
export function isDirectMessage(report: Pick<ReportResponse, "source">): boolean {
  return report.source === "DIRECT_MESSAGE";
}

/** The source as the ledger shows it, with the evidence count for a direct-message report. */
export function sourceLabel(report: Pick<ReportResponse, "source" | "evidenceCount">): string {
  if (!isDirectMessage(report)) return "Profile";
  const count = report.evidenceCount ?? 0;
  return `Direct message · ${count} ${count === 1 ? "message" : "messages"}`;
}

/** What one captured message says, in words — a sticker or a video is an id, never a picture or a link. */
export function describeEvidence(item: Pick<ReportEvidenceItem, "type" | "text" | "stickerId" | "videoId">): string {
  switch (item.type) {
    case "TEXT":
      return item.text ?? "";
    case "STICKER":
      return `Sticker ${item.stickerId ?? ""}`.trim();
    case "VIDEO":
      return item.text ? `Shared video ${item.videoId ?? ""} — “${item.text}”` : `Shared video ${item.videoId ?? ""}`.trim();
    default:
      return item.text ?? `${item.type} message`;
  }
}
