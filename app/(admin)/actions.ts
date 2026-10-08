"use server";

import { getHandles } from "@/lib/api/names";
import { getReport } from "@/lib/api/reports";
import { getAdminUser, listUsers } from "@/lib/api/users";
import { getVideo, listVideos } from "@/lib/api/videos";
import { exportRows } from "@/lib/api/export";
import type { AdminUserResponse, AdminVideoResponse, ReportResponse } from "@/lib/api/types";
import {
  EXPORT_DATASETS,
  EXPORT_MAX_ROWS,
  csvFilename,
  toCsv,
  type ExportDataset,
} from "@/lib/csv";
import { REPORT_STATUS_LABELS, USER_STATUS_LABELS, VIDEO_STATUS_LABELS } from "@/lib/labels";
import type { ListParams } from "@/lib/list-filters";
import { targetHref } from "@/lib/moderation";
import { looksLikeId } from "@/lib/search";

/** One row of the search palette: what the row shows and where it leads, not the record behind it. */
export interface SearchHit {
  id: string;
  title: string;
  detail: string | null;
  href: string;
  /** A video's poster frame. Null for accounts and reports, and for a video without one. */
  thumbnailUrl: string | null;
}

export interface SearchResults {
  users: SearchHit[];
  videos: SearchHit[];
  reports: SearchHit[];
}

const PER_GROUP = 5;
const NOTHING: SearchResults = { users: [], videos: [], reports: [] };

const TARGET_NOUNS = { USER: "an account", VIDEO: "a video", COMMENT: "a comment" } as const;

/**
 * The topbar search: accounts by handle or email, videos by title or by the accounts the term
 * names, and — for a pasted id — the account, video or report it belongs to.
 *
 * One action for all of it: Next dispatches server actions one at a time per client, so a call
 * per kind would queue behind each other. Every source is non-fatal — a service that is down
 * costs its own group, not the whole palette.
 */
export async function searchConsoleAction(query: string): Promise<SearchResults> {
  const term = typeof query === "string" ? query.trim().slice(0, 100) : "";
  if (term.length < 2) return NOTHING;
  const byId = looksLikeId(term);

  const [users, exactUser, exactVideo, exactReport] = await Promise.all([
    listUsers({ q: term, size: PER_GROUP })
      .then((page) => page.content)
      .catch((): AdminUserResponse[] => []),
    byId ? getAdminUser(term).catch(() => null) : null,
    byId ? getVideo(term).catch(() => null) : null,
    byId ? getReport(term).catch(() => null) : null,
  ]);

  // An owner's handle finds their uploads too, same as the Videos page's own search box.
  const videos = withFirst(
    exactVideo,
    await listVideos({ q: term, ownerIds: users.map((user) => user.id), size: PER_GROUP })
      .then((page) => page.content)
      .catch((): AdminVideoResponse[] => []),
  );
  const owners = await getHandles(videos.map((video) => video.userId));

  return {
    users: withFirst(exactUser, users).map(userHit),
    videos: videos.map((video) => videoHit(video, owners[video.userId] ?? null)),
    reports: exactReport ? [reportHit(exactReport)] : [],
  };
}

/** The exact-id match first, without listing it twice when the text search found it as well. */
function withFirst<T extends { id: string }>(exact: T | null, rows: T[]): T[] {
  if (!exact) return rows;
  return [exact, ...rows.filter((row) => row.id !== exact.id)].slice(0, PER_GROUP);
}

function userHit(user: AdminUserResponse): SearchHit {
  return {
    id: user.id,
    title: `@${user.username}`,
    detail: [user.email, USER_STATUS_LABELS[user.status], user.role === "ADMIN" ? "Admin" : null]
      .filter(Boolean)
      .join(" · "),
    href: `/users/${user.id}`,
    thumbnailUrl: null,
  };
}

function videoHit(video: AdminVideoResponse, owner: string | null): SearchHit {
  return {
    id: video.id,
    title: video.title || "(untitled upload)",
    detail: [owner, video.deletedAt ? "Deleted by its owner" : VIDEO_STATUS_LABELS[video.status]]
      .filter(Boolean)
      .join(" · "),
    href: `/videos/${video.id}`,
    // Once the media is purged the thumbnail url points at nothing.
    thumbnailUrl: video.purgeEventPublishedAt ? null : video.thumbnailUrl,
  };
}

function reportHit(report: ReportResponse): SearchHit {
  return {
    id: report.id,
    title: `Report #${report.id.slice(-8)} — ${report.reason}`,
    detail: `Against ${TARGET_NOUNS[report.targetType]} · ${REPORT_STATUS_LABELS[report.status]}`,
    // A report has no page of its own; what it points at is the thing to open.
    href: targetHref(report.targetType, report.targetId) ?? "/moderation/reports",
    thumbnailUrl: null,
  };
}

export type CsvExportResult =
  | { ok: true; csv: string; filename: string; truncated: boolean }
  | { ok: false; message: string };

/**
 * A listing's Export button: every row the page's filters match, rather than the page on screen.
 * Answered whole rather than streamed, since a server action answers once; the row cap keeps that
 * to a few megabytes. A file cut at the cap says so in its name.
 */
export async function exportCsvAction(
  dataset: ExportDataset,
  params: ListParams,
): Promise<CsvExportResult> {
  if (!EXPORT_DATASETS.includes(dataset)) return { ok: false, message: "Nothing to export." };
  try {
    const { rows, truncated } = await exportRows(dataset, params);
    return {
      ok: true,
      csv: toCsv(rows),
      filename: csvFilename(truncated ? `${dataset}-first-${EXPORT_MAX_ROWS}` : dataset),
      truncated,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
