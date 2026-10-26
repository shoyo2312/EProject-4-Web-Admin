import Link from "next/link";
import { ArrowRight } from "lucide-react";
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
        <p className="px-5 py-8 text-center text-[12px] text-ink-faint">
          {actions === null ? "The audit log could not be read." : "No decisions recorded yet."}
        </p>
      ) : (
        <ol className="relative px-5 py-2">
          <span className="absolute top-5 bottom-5 left-[23px] w-px bg-line" />
          {actions.map((action) => {
            const href = targetHref(action.targetType, action.targetId);
            const name =
              targetName(names, action.targetType, action.targetId) ?? idTail(action.targetId);
            return (
              <li key={action.id} className="relative flex gap-3 py-2.5">
                <span className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-surface bg-accent ring-1 ring-line" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px]">
                    <span className="font-medium">{ACTION_LABELS[action.actionType]}</span>{" "}
                    {href ? (
                      <Link href={href as never} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <span className="text-ink-soft">{name}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">
                    {names.handles[action.adminId] ?? idTail(action.adminId)} ·{" "}
                    {relativeTime(action.createdAt, now)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-auto border-t border-line px-5 py-3">
        <Link
          href="/moderation/actions"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
        >
          Full audit log <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </Card>
  );
}
