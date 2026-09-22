import { MessageSquare } from "lucide-react";
import { CommentsTable } from "@/components/comments/comments-table";
import { VideoPicker } from "@/components/comments/video-picker";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import {
  getDailyAdminStats,
  listComments,
  listVideos,
  referenceNow,
} from "@/lib/api/admin";
import { historyUpTo, isoDay, resolveWindow } from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import type { AdminCommentFilter } from "@/lib/api/types";
import { decoratePage, type CommentPageView } from "./actions";

const FILTERS: AdminCommentFilter[] = ["THREAD", "REPLIES", "REMOVED"];

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    videoId?: string;
    filter?: string;
    p?: string;
    asOf?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, videoId, filter } = params;
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { periodDays, periodLabel, compareLabel } = window;
  // A filter left in the URL by hand has to resolve to something real: it is passed straight to
  // interaction-service, which rejects anything the enum does not name.
  const selectedFilter = FILTERS.find((f) => f === filter) ?? "THREAD";

  let videos;
  let adminStats;
  let comments: CommentPageView | null = null;
  try {
    // Platform-wide, unlike everything else on this page: interaction-service stores comments
    // partitioned by video, so there is no comment series to trend — the one dated record of
    // comment moderation is the audit log.
    adminStats = await getDailyAdminStats(window.fetchDays);
    // The picker is a search box, not a directory: the matches that fit the rail, and the
    // admin narrows with q rather than paging to find a video.
    videos = (await listVideos({ q, size: 50 })).content;
    // Only a video that is actually in the list may be opened: a videoId left in the URL from a
    // previous search would otherwise render a thread with nothing selected beside it.
    const selected = videoId && videos.some((v) => v.id === videoId) ? videoId : null;
    // Only the first page. The rest is pulled in by the table as the admin asks for it — a thread
    // can run to thousands, and before this it was read as one slab and silently cut off at 50.
    comments = selected
      ? await decoratePage(selected, await listComments(selected, { filter: selectedFilter }))
      : null;
  } catch (error) {
    return (
      <>
        <PageHeader title="Comments" />
        <ErrorState error={error} />
      </>
    );
  }

  const selected = videos.find((v) => v.id === videoId && comments !== null) ?? null;

  // Daily and uncut, so the delta compares the period against the period before it.
  const removalCounts = historyUpTo(adminStats, window).map((d) => d.commentsRemoved);

  const cards: KpiCard[] = [
    {
      label: "Comments Removed",
      value: formatNumber(sumLast(removalCounts, periodDays)),
      unit: periodLabel,
      // Not inverted: more removals is moderation happening, not the comment section
      // getting worse. Nothing here counts how many comments were written, so there is no
      // rate to put it over — interaction-service has no platform-wide comment feed.
      delta: deltaPercent(removalCounts, periodDays),
      deltaLabel: compareLabel,
      spark: spark(removalCounts, window.chartDays),
    },
    {
      label: "Thread",
      // The selected video's own running total, which video-service keeps on the document —
      // the comment page itself is cursor-paged and cannot say how long the thread is. Null
      // means the owner turned comments off, which is not the same as zero.
      value:
        selected == null
          ? "—"
          : selected.commentCount === null
            ? "Off"
            : formatNumber(selected.commentCount),
      // No percentage: a thread is not dated history, it is one video's comments right now.
      unit: selected ? "Comments on this video" : "No video selected",
    },
  ];

  return (
    <>
      <PageHeader
        title="Comments"
        subtitle="Read a video's thread and remove a comment on a user's behalf. Removals are recorded in the audit log; there is no undo."
        filters={{ period: window.period, asOf: window.asOf, latest }}
      />

      <div className="mb-4">
        <KpiCards cards={cards} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
        <VideoPicker videos={videos} query={q ?? ""} selectedId={selected?.id ?? null} />

        {selected && comments ? (
          <CommentsTable
            key={`${selected.id}:${selectedFilter}`}
            page={comments}
            videoId={selected.id}
            filter={selectedFilter}
            videoTitle={selected.title}
          />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <MessageSquare className="h-5 w-5 text-ink-faint" />
            <p className="text-[12px] text-ink-soft">Pick a video to read its thread.</p>
            <p className="max-w-sm text-[11px] text-ink-faint">
              There is no platform-wide comment feed: interaction-service stores comments
              partitioned by video, so a thread is only reachable through the video it is on.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
