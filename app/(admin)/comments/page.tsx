import { MessageSquare } from "lucide-react";
import { CommentsTable } from "@/components/comments/comments-table";
import { VideoPicker } from "@/components/comments/video-picker";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getDailyAdminStats } from "@/lib/api/analytics";
import { decorateCommentPage, getComments, listComments } from "@/lib/api/comments";
import { referenceNow } from "@/lib/api/shared";
import { getVideo, listVideos } from "@/lib/api/videos";
import { historyUpTo, isoDay, resolveWindow } from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import type { AdminCommentFilter } from "@/lib/api/types";
import type { CommentPageView } from "@/lib/comments";

const FILTERS: AdminCommentFilter[] = ["THREAD", "REPLIES", "REMOVED", "HELD"];

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    videoId?: string;
    /** A comment to pin above the thread — where a report or a notification on one lands. */
    comment?: string;
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
  let linked: CommentPageView | null | undefined;
  try {
    const [stats, matches] = await Promise.all([
      // Platform-wide, unlike everything else on this page: interaction-service stores comments
      // partitioned by video, so there is no comment series to trend — the one dated record of
      // comment moderation is the audit log.
      getDailyAdminStats(window.fetchDays),
      // The picker is a search box, not a directory: the matches that fit the rail, and the
      // admin narrows with q rather than paging to find a video.
      listVideos({ q, size: 50 }),
    ]);
    adminStats = stats;
    videos = matches.content;
    // A video linked to directly — from its own page, or a report on one of its comments — is
    // older than the fifty the rail holds once the platform has more, so it is looked up by id and
    // joins the top of the rail.
    if (videoId && !q && !videos.some((v) => v.id === videoId)) {
      const linked = await getVideo(videoId);
      if (linked) videos = [linked, ...videos];
    }
    // Only a video that is actually in the list may be opened: a videoId beside a search it does
    // not match would otherwise render a thread with nothing selected beside it.
    const selected = videoId && videos.some((v) => v.id === videoId) ? videoId : null;
    // Only the first page. The rest is pulled in by the table as the admin asks for it — a thread
    // can run to thousands, and before this it was read as one slab and silently cut off at 50.
    comments = selected
      ? await decorateCommentPage(selected, await listComments(selected, { filter: selectedFilter }))
      : null;
    // The comment a link named, by id: a thread is paged newest first, so a reported comment from
    // last month would otherwise be any number of Load more clicks down. A failed lookup is null
    // rather than a failed page — the thread is still worth showing.
    if (selected && params.comment) {
      const found = await getComments(selected, [params.comment]).catch(() => null);
      linked = found
        ? await decorateCommentPage(selected, { items: found, nextCursor: null, hasMore: false })
        : null;
    }
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
  const removalCounts = historyUpTo(adminStats, window, (d) => d.commentsRemoved);

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
            linked={linked}
          />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <MessageSquare className="h-5 w-5 text-ink-faint" />
            <p className="text-[13px] text-ink-soft">Pick a video to read its thread.</p>
            <p className="max-w-sm text-[12px] text-ink-faint">
              Comments are read one video at a time — there is no feed of every comment on the
              platform. Reported comments open straight from the Reports Queue.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
