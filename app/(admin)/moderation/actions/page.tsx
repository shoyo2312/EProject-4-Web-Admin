import { AlertTriangle } from "lucide-react";
import { ActionsTable } from "@/components/moderation/actions-table";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, listModerationActions, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf, parsePage } from "@/lib/api/window";
import { ENFORCED } from "@/lib/moderation";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string; page?: string }>;
}) {
  const { asOf: asOfParam, page: pageParam } = await searchParams;
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);
  const pageIndex = parsePage(pageParam);

  let page;
  try {
    page = await listModerationActions({ page: pageIndex });
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
  const unenforced = actions.filter(
    (a) => !ENFORCED.includes(a.actionType),
  ).length;

  return (
    <>
      <PageHeader
        title="Moderation Audit Log"
        subtitle="Every action taken by an admin, in order. Append-only."
        filters={{ asOf, latest }}
        csv={{ name: "moderation-actions", rows: actions }}
      />

      {unenforced > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-pending/30 bg-pending-bg px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pending" />
          <p className="text-[12px] text-ink-soft">
            <span className="font-semibold text-ink">
              {unenforced} of the {actions.length} actions on this page are
              recorded but not enforced.
            </span>{" "}
            Video takedown/restore, user ban/unban and comment removal have
            consumers today. Warn and product suspension publish to{" "}
            <code className="rounded bg-surface px-1 py-0.5">
              admin.moderation-events
            </code>{" "}
            with no subscriber in user-service or product-service.
          </p>
        </div>
      ) : null}

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
