import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { VideosTable } from "@/components/videos/videos-table";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getDailyAdminStats,
  getDailyVideoStats,
  getUserProfiles,
  listVideos,
  referenceNow,
  resolveOwners,
} from "@/lib/api/admin";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, growthPercent, spark, sumLast } from "@/lib/series";
import { formatCompact, formatNumber } from "@/lib/format";
import type { VideoStatus } from "@/lib/api/types";

const STATUSES: VideoStatus[] = [
  "PROCESSING",
  "PENDING_MODERATION",
  "PENDING_REVIEW",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
  "TAKEN_DOWN",
];

function parseStatus(value: string | undefined): VideoStatus | undefined {
  return STATUSES.includes(value as VideoStatus) ? (value as VideoStatus) : undefined;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; p?: string; asOf?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, status, page: pageParam } = params;
  const filter = parseStatus(status);
  // Not a VideoStatus — a deleted video keeps its pipeline status, so this filters on
  // deletedAt via listVideos({ deleted: true }) instead of the status query param.
  const deletedOnly = status === "DELETED";
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { asOf, periodDays, compareLabel } = window;
  const pageIndex = parsePage(pageParam);

  let page;
  let counts;
  let videoStats;
  let adminStats;
  try {
    // A handle is a search term like any other to whoever typed it, but video-service has never
    // heard of handles — it stores owner ids. Resolving here rather than inside listVideos keeps
    // it to one directory call for the six listing calls below, which all share the term.
    const ownerIds = q ? await resolveOwners(q) : [];

    /**
     * A status total across the whole library, not the page: a one-row request exists only for
     * its `totalElements`. Counting the rows on screen would report "2 to review" when the
     * queue holds four hundred.
     */
    const countByStatus = (s: VideoStatus) =>
      listVideos({ q, ownerIds, status: s, size: 1 }).then((p) => p.totalElements);

    // Filtering and paging server-side rather than over the fetched rows: "show me everything
    // taken down" must not depend on how many rows happened to come back.
    const [listed, uploads, moderation, ...totals] = await Promise.all([
      listVideos({ q, ownerIds, status: filter, deleted: deletedOnly ? true : undefined, page: pageIndex }),
      // Uploads per day, plus each day's cohort standing — the series behind the percentages.
      getDailyVideoStats(window.fetchDays),
      // Takedowns are an admin decision, recorded in the audit log rather than on the video:
      // the library knows a video is down, not the day it went down.
      getDailyAdminStats(window.fetchDays),
      countByStatus("PENDING_REVIEW"),
      countByStatus("TAKEN_DOWN"),
      countByStatus("REJECTED"),
      countByStatus("PROCESSING"),
      countByStatus("FAILED"),
    ]);
    page = listed;
    videoStats = uploads;
    adminStats = moderation;
    const [review, down, rejected, processing, failed] = totals;
    counts = {
      awaitingReview: review,
      takenDown: down + rejected,
      stuck: processing + failed,
    };
  } catch (error) {
    return (
      <>
        <PageHeader title="Videos" />
        <ErrorState error={error} />
      </>
    );
  }

  // ponytail: the date cut runs over the page rather than the query, because video-service
  // takes no date parameter — a page of uploads newer than the picked date comes back short
  // instead of being skipped. Push a `createdBefore` param into AdminVideoController if that
  // starts to bite. The status totals above ignore it for the same reason.
  const videos = page.content.filter((v) => v.createdAt.slice(0, 10) <= asOf);
  const views = videos.reduce((sum, v) => sum + v.viewCount, 0);

  // Daily and uncut, so a delta compares the period against the period before it.
  const daily = historyUpTo(videoStats, window);
  const uploadCounts = daily.map((d) => d.uploads);
  const reviewCohort = daily.map((d) => d.pendingReview);
  const stuckCohort = daily.map((d) => d.notPlayable);
  const takedownCounts = historyUpTo(adminStats, window).map((d) => d.videosTakenDown);

  // The percentages below pair a library-wide total with a library-wide series, so a search or
  // a status filter — which narrows the total but not the series — has to drop them.
  const filtered = Boolean(q || filter);
  const uploads = sumLast(uploadCounts, periodDays);

  const cards: KpiCard[] = [
    {
      label: "Matching",
      value: formatNumber(page.totalElements),
      unit: "Videos",
      // Cumulative, so the growth is this period's uploads over the size the library had
      // when the period began — not one period's uploads against another's.
      delta: filtered ? null : growthPercent(page.totalElements, uploads),
      deltaLabel: compareLabel,
      spark: spark(uploadCounts, window.chartDays),
    },
    {
      label: "To Review",
      value: formatNumber(counts.awaitingReview),
      unit: "Backlog",
      // The worklist. Everything else on this row is a report; this one is a number that is
      // supposed to go down, and a video sitting in it is one nobody can watch until an
      // admin looks — so rising reads red.
      //
      // ponytail: the series is a cohort, not a flow. Nothing stamps the moment a video
      // entered review, so this counts the videos uploaded in each period that are *still*
      // waiting — which answers "is the backlog growing" and undercounts any period whose
      // videos have since been cleared. Give Video a `statusChangedAt` if the distinction
      // starts to matter.
      delta: filtered ? null : deltaPercent(reviewCohort, periodDays),
      deltaLabel: `still waiting, ${compareLabel}`,
      invertDelta: true,
      spark: spark(reviewCohort, window.chartDays),
    },
    {
      label: "Taken Down",
      value: formatNumber(counts.takenDown),
      unit: "Videos",
      // An admin's takedown and the classifier's own removal, together: for this count what
      // matters is that the video is off the platform. The percentage is on the admin half
      // alone — the audit log is the only thing that dates a removal — so it understates a
      // period in which the classifier did most of the removing.
      delta: filtered ? null : growthPercent(counts.takenDown, sumLast(takedownCounts, periodDays)),
      deltaLabel: `by admins, ${compareLabel}`,
      spark: spark(takedownCounts, window.chartDays),
    },
    {
      label: "Not Playable",
      value: formatNumber(counts.stuck),
      // Processing and failed together: both mean nobody can watch it, and a queue that
      // stops draining shows up here before anywhere else. Same cohort caveat as To Review.
      unit: `${formatCompact(views)} views on this page`,
      delta: filtered ? null : deltaPercent(stuckCohort, periodDays),
      deltaLabel: `still stuck, ${compareLabel}`,
      invertDelta: true,
      spark: spark(stuckCohort, window.chartDays),
    },
  ];

  // Owner handles for the rows on screen. user-service owns them; video-service only has the id.
  // Non-fatal — a row just falls back to showing the raw id if this lookup is unavailable.
  const owners = await getUserProfiles(videos.map((v) => v.userId)).catch(() => ({}));

  return (
    <>
      <PageHeader
        title="Videos"
        subtitle="Every upload on the platform. Taking one down writes a moderation action and removes it from the feed."
        filters={{ period: window.period, asOf, latest }}
        csv={{ name: "videos", rows: videos }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <VideosTable
          videos={videos}
          owners={owners}
          query={q ?? ""}
          status={deletedOnly ? "DELETED" : (filter ?? "ALL")}
        />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="videos"
        />
      </div>
    </>
  );
}
