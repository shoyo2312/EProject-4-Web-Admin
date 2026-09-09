import { AlertTriangle } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import { listModerationActions, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf } from "@/lib/api/window";
import type { ModerationActionType } from "@/lib/api/types";
import { relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Only TAKEDOWN_VIDEO / RESTORE_VIDEO currently have a downstream consumer
 * (video-service AdminModerationEventConsumer). The rest are recorded in
 * moderation_actions and published to admin.moderation-events, but nothing
 * subscribes yet — the console says so rather than implying the action landed.
 */
const ENFORCED: ModerationActionType[] = ["TAKEDOWN_VIDEO", "RESTORE_VIDEO"];

const DESTRUCTIVE: ModerationActionType[] = [
  "BAN_USER",
  "TAKEDOWN_VIDEO",
  "SUSPEND_PRODUCT",
  "WARN_USER",
];

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
            Only video takedown/restore has a consumer today. Ban, warn and product
            suspension publish to{" "}
            <code className="rounded bg-surface px-1 py-0.5">
              admin.moderation-events
            </code>{" "}
            with no subscriber in user-service or product-service.
          </p>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Recent Actions"
          hint="GET /api/v1/admin/actions"
          actions={<CardMenuButton />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps px-5 py-3 text-ink-soft">Admin</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Action</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Target</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Reason</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Report</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Enforced</th>
                <th className="label-caps px-5 py-3 text-right text-ink-soft">
                  When
                </th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr
                  key={action.id}
                  className="border-b border-line last:border-b-0 transition-colors hover:bg-surface-muted"
                >
                  <td className="figure px-5 py-3 whitespace-nowrap">
                    #{shortId(action.adminId.slice(-8), 8)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] tracking-wider",
                        DESTRUCTIVE.includes(action.actionType)
                          ? "border-danger/25 bg-danger-bg text-danger"
                          : "border-line bg-surface-muted text-ink-soft",
                      )}
                    >
                      {action.actionType}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <TargetBadge type={action.targetType} id={action.targetId} />
                  </td>
                  <td
                    className="max-w-[240px] truncate px-3 py-3"
                    title={action.reason}
                  >
                    {action.reason}
                  </td>
                  <td className="figure px-3 py-3 whitespace-nowrap text-ink-faint">
                    {action.reportId ? `#${action.reportId.slice(-8)}` : "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {ENFORCED.includes(action.actionType) ? (
                      <span className="text-success">yes</span>
                    ) : (
                      <span className="text-pending">no consumer</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap text-ink-faint">
                    {relativeTime(action.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
