import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { VideosTable } from "@/components/videos/videos-table";
import { Pager } from "@/components/ui/pager";
import { getDailyAdminStats, getDailyVideoStats } from "@/lib/api/analytics";
import { getUserProfiles } from "@/lib/api/names";
import { LIST_PAGE_SIZE, referenceNow } from "@/lib/api/shared";
import { resolveOwners } from "@/lib/api/users";
import { getVideoStatusCounts, listVideos } from "@/lib/api/videos";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, growthChange, spark, sumLast } from "@/lib/series";
import { formatCompact, formatNumber, plural } from "@/lib/format";
import { videoFilters } from "@/lib/list-filters";
import type { UserProfileResponse } from "@/lib/api/types";

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    owner?: string;
    status?: string;
    p?: string;
    asOf?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, ownerId, status: filter, deletedOnly } = videoFilters(params);
  const pageParam = params.page;
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { asOf, periodDays, compareLabel } = window;
  const pageIndex = parsePage(pageParam);

  let page;
  let counts: { awaitingReview: number; takenDown: number; stuck: number } | null;
  let videoStats;
  let adminStats;
  try {
    // A handle is a search term like any other to whoever typed it, but video-service has never
    // heard of handles — it stores owner ids. Resolving here rather than inside listVideos keeps
    // it to one directory call for the listing and the totals, which share the term.
    const ownerIds = ownerId ? [ownerId] : q ? await resolveOwners(q) : [];

    // Filtering and paging server-side rather than over the fetched rows: "show me everything
    // taken down" must not depend on how many rows happened to come back.
    const [listed, uploads, moderation, totals] = await Promise.all([
      listVideos({ q, ownerIds, status: filter, deleted: deletedOnly ? true : undefined, page: pageIndex }),
      // Uploads per day, plus each day's cohort standing — the series behind the percentages.
      getDailyVideoStats(window.fetchDays),
      // Takedowns are an admin decision, recorded in the audit log rather than on the video:
      // the library knows a video is down, not the day it went down.
      getDailyAdminStats(window.fetchDays),
      // Status totals across the whole library, not the page: counting the rows on screen would
      // report "2 to review" when the queue holds four hundred. The cards' figures, not the list,
      // so a failure leaves the cards blank rather than the page — a video-service that predates
      // this endpoint answers it with a 404 until it is redeployed.
      getVideoStatusCounts({ q, ownerIds }).catch(() => null),
    ]);
    page = listed;
    videoStats = uploads;
    adminStats = moderation;
    counts = totals && {
      awaitingReview: totals.PENDING_REVIEW,
      takenDown: totals.TAKEN_DOWN + totals.REJECTED,
      stuck: totals.PROCESSING + totals.FAILED,
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
  const uploadCounts = historyUpTo(videoStats, window, (d) => d.uploads);
  const reviewCohort = historyUpTo(videoStats, window, (d) => d.pendingReview);
  const stuckCohort = historyUpTo(videoStats, window, (d) => d.notPlayable);
  const takedownCounts = historyUpTo(adminStats, window, (d) => d.videosTakenDown);

  // The percentages below pair a library-wide total with a library-wide series, so a search or
  // a status filter — which narrows the total but not the series — has to drop them.
  const filtered = Boolean(q || ownerId || filter);
  const uploads = sumLast(uploadCounts, periodDays);
  const libraryGrowth = filtered ? null : growthChange(page.totalElements, uploads);
  const takedownGrowth = filtered || !counts
    ? null
    : growthChange(counts.takenDown, sumLast(takedownCounts, periodDays));
  /** A status total, or a dash when the totals could not be read. */
  const total = (figure: number | undefined) => (figure === undefined ? "—" : formatNumber(figure));

  const cards: KpiCard[] = [
    {
      label: "Matching",
      value: formatNumber(page.totalElements),
      unit: "Videos",
      // Cumulative, so the growth is this period's uploads over the size the library had
      // when the period began — not one period's uploads against another's. A library that
      // was empty when the period began shows the count it gained instead.
      delta: libraryGrowth?.value,
      deltaUnit: libraryGrowth?.unit,
      deltaLabel: compareLabel,
      spark: spark(uploadCounts, window.chartDays),
    },
    {
      label: "To Review",
      value: total(counts?.awaitingReview),
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
      value: total(counts?.takenDown),
      unit: "Videos",
      // An admin's takedown and the classifier's own removal, together: for this count what
      // matters is that the video is off the platform. The percentage is on the admin half
      // alone — the audit log is the only thing that dates a removal — so it understates a
      // period in which the classifier did most of the removing.
      delta: takedownGrowth?.value,
      deltaUnit: takedownGrowth?.unit,
      deltaLabel: `by admins, ${compareLabel}`,
      spark: spark(takedownCounts, window.chartDays),
    },
    {
      label: "Not Playable",
      value: total(counts?.stuck),
      // Processing and failed together: both mean nobody can watch it, and a queue that
      // stops draining shows up here before anywhere else. Same cohort caveat as To Review.
      unit: `${formatCompact(views)} ${plural(views, "view")} on this page`,
      delta: filtered ? null : deltaPercent(stuckCohort, periodDays),
      deltaLabel: `still stuck, ${compareLabel}`,
      invertDelta: true,
      spark: spark(stuckCohort, window.chartDays),
    },
  ];

  // Owner handles for the rows on screen, and for the owner filter even when it matched nothing.
  // user-service owns them; video-service only has the id. Non-fatal — a row just falls back to
  // showing the raw id if this lookup is unavailable.
  const owners: Record<string, UserProfileResponse> = await getUserProfiles([
    ...videos.map((v) => v.userId),
    ...(ownerId ? [ownerId] : []),
  ]).catch(() => ({}));

  return (
    <>
      <PageHeader
        title="Videos"
        subtitle="Every upload on the platform. Taking one down writes a moderation action and removes it from the feed."
        filters={{ period: window.period, asOf, latest }}
        csv={{
          name: "videos",
          rows: videos,
          all: { dataset: "videos", params, total: page.totalElements },
        }}
      />

      <div className="space-y-4">
        <KpiCards cards={cards} />

        <VideosTable
          videos={videos}
          owners={owners}
          query={q ?? ""}
          ownerId={ownerId ?? null}
          status={deletedOnly ? "DELETED" : (filter ?? "ALL")}
          now={referenceNow()}
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
