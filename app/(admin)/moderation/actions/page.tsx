import { ActionsTable } from "@/components/moderation/actions-table";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getDailyAdminStats,
  listModerationActions,
  referenceNow,
} from "@/lib/api/admin";
import { historyUpTo, isoDay, parsePage, resolveWindow } from "@/lib/api/window";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; asOf?: string; page?: string }>;
}) {
  const params = await searchParams;
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { asOf, periodDays, periodLabel, compareLabel } = window;
  const pageIndex = parsePage(params.page);

  let page;
  let adminStats;
  try {
    [page, adminStats] = await Promise.all([
      listModerationActions({ page: pageIndex }),
      // The page itself is one slice of the log; the counts above it are the whole of it,
      // which is the only way a percentage over a year means anything.
      getDailyAdminStats(window.fetchDays),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Moderation Audit Log" />
        <ErrorState error={error} />
      </>
    );
  }

  // Append-only, so cutting at the picked date really is the log as it stood then.
  // ponytail: the cut runs over the page rather than the query — admin-service takes no date
  // parameter, so a page of newer entries comes back short instead of being skipped.
  const actions = page.content.filter((a) => a.createdAt.slice(0, 10) <= asOf);

  // Daily and uncut, so a delta compares the period against the period before it. Every
  // figure here is a flow — the log records decisions, and a decision is an event, not a
  // standing total — so all four compare period against period rather than against a stock.
  const series = {
    taken: historyUpTo(adminStats, window, (d) => d.actionsTaken),
    bans: historyUpTo(adminStats, window, (d) => d.usersBanned),
    takedowns: historyUpTo(adminStats, window, (d) => d.videosTakenDown),
    removals: historyUpTo(adminStats, window, (d) => d.commentsRemoved),
  };

  const card = (label: string, values: number[]): KpiCard => ({
    label,
    value: formatNumber(sumLast(values, periodDays)),
    unit: periodLabel,
    delta: deltaPercent(values, periodDays),
    deltaLabel: compareLabel,
    spark: spark(values, window.chartDays),
  });

  const cards: KpiCard[] = [
    card("Actions Taken", series.taken),
    card("Users Banned", series.bans),
    card("Videos Taken Down", series.takedowns),
    card("Comments Removed", series.removals),
  ];

  return (
    <>
      <PageHeader
        title="Moderation Audit Log"
        subtitle="Every action taken by an admin, in order. Append-only."
        filters={{ period: window.period, asOf, latest }}
        csv={{ name: "moderation-actions", rows: actions }}
      />

      <div className="mb-4">
        <KpiCards cards={cards} />
      </div>

      {/* The table's own search, type tabs and sort work over the rows on this page —
          they are client-side, and the page is what the server sent. */}
      <ActionsTable actions={actions} />

      <Pager
        page={page.number}
        totalPages={page.totalPages}
        total={page.totalElements}
        size={LIST_PAGE_SIZE}
        label="actions"
      />
    </>
  );
}
