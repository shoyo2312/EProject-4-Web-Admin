import { ActionsTable } from "@/components/moderation/actions-table";
import { KpiCards, type KpiCard } from "@/components/dashboard/kpi-cards";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/ui/pager";
import { getDailyAdminStats } from "@/lib/api/analytics";
import { listModerationActions } from "@/lib/api/moderation";
import { getRowNames } from "@/lib/api/names";
import { LIST_PAGE_SIZE, referenceNow } from "@/lib/api/shared";
import { historyUpTo, isoDay, parsePage, resolveWindow, windowRange } from "@/lib/api/window";
import { auditFilters } from "@/lib/list-filters";
import { deltaPercent, spark, sumLast } from "@/lib/series";
import { formatNumber } from "@/lib/format";
import { idsToName } from "@/lib/names";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    p?: string;
    asOf?: string;
    page?: string;
    admin?: string;
    type?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const latest = isoDay(referenceNow());
  const window = resolveWindow(params, latest);
  const { asOf, periodDays, periodLabel, compareLabel } = window;
  const pageIndex = parsePage(params.page);
  // Both come from the query string, where anything can be typed. Dropped rather than passed
  // on: admin-service answers a non-numeric id or an unknown type with a 400 for the whole page.
  const { adminId, actionType, sort, ascending } = auditFilters(params);
  // The log covers the same days as the figures above it, so its total is the "Actions Taken"
  // card's value — and "what did this admin do yesterday" is the Day period on yesterday.
  const { from, to } = windowRange(window);

  let page;
  let adminStats;
  try {
    [page, adminStats] = await Promise.all([
      listModerationActions({ page: pageIndex, adminId, actionType, from, to, sort, ascending }),
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

  const actions = page.content;
  // The admin filter is named too, so its chip says who rather than which id.
  const wanted = idsToName(actions);
  const names = await getRowNames(wanted.userIds, wanted.videoIds, [
    ...actions.map((a) => a.adminId),
    adminId ?? null,
  ]);

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
        csv={{
          name: "moderation-actions",
          rows: actions,
          all: { dataset: "moderation-actions", params, total: page.totalElements },
        }}
      />

      <div className="mb-4">
        <KpiCards cards={cards} />
      </div>

      {/* The type and admin filters go to the server with the period. The search box, the
          enforcement tabs and the sort work over the rows on this page only. */}
      <ActionsTable
        actions={actions}
        names={names}
        adminId={adminId}
        actionType={actionType}
        sort={sort}
        ascending={ascending}
      />

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
