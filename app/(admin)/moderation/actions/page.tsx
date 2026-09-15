import { AlertTriangle } from "lucide-react";
import { ActionsTable } from "@/components/moderation/actions-table";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { listModerationActions, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf } from "@/lib/api/window";
import { ENFORCED } from "@/lib/moderation";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>;
}) {
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf((await searchParams).asOf, latest);

  let actions;
  try {
    // Append-only, so cutting at the picked date really is the log as it stood then.
    actions = (await listModerationActions(100)).filter(
      (a) => a.createdAt.slice(0, 10) <= asOf,
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Moderation Audit Log" />
        <ErrorState error={error} />
      </>
    );
  }

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
              {unenforced} of {actions.length} actions are recorded but
              not enforced.
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

      <ActionsTable actions={actions} />
    </>
  );
}
