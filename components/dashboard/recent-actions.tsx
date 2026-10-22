import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { ModerationActionResponse } from "@/lib/api/types";
import { relativeTime, shortId } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/labels";
import { targetHref } from "@/lib/moderation";
import { targetName, type RowNames } from "@/lib/names";

const idTail = (id: string) => `#${shortId(id.slice(-8), 8)}`;

export function RecentActions({
  actions,
  names,
  now,
}: {
  /** Null when the audit log could not be read. */
  actions: ModerationActionResponse[] | null;
  names: RowNames;
  now: number;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Recent decisions"
        hint="The newest entries of the audit log up to the picked day: who decided what, on which account, video or comment."
      />
      {actions === null || actions.length === 0 ? (
        <p className="px-5 py-6 text-center text-[11px] text-ink-faint">
          {actions === null ? "The audit log could not be read." : "No decisions recorded yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {actions.map((action) => {
            const href = targetHref(action.targetType, action.targetId);
            const name =
              targetName(names, action.targetType, action.targetId) ?? idTail(action.targetId);
            return (
              <li key={action.id} className="px-5 py-3">
                <p className="text-[12px]">
                  <span className="font-medium">{ACTION_LABELS[action.actionType]}</span>{" "}
                  {href ? (
                    <Link href={href as never} className="underline-offset-4 hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {names.handles[action.adminId] ?? idTail(action.adminId)} ·{" "}
                  {relativeTime(action.createdAt, now)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto border-t border-line px-5 py-3 text-right">
        <Link
          href="/moderation/actions"
          className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
        >
          Full audit log →
        </Link>
      </div>
    </Card>
  );
}
