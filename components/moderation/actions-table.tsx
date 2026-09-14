"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import type { ModerationActionResponse, ModerationActionType } from "@/lib/api/types";
import { formatDate, relativeTime, shortId } from "@/lib/format";
import { useBelowXl } from "@/lib/use-below-xl";
import { cn } from "@/lib/utils";

/**
 * Action types with a live downstream consumer today:
 * video-service (takedown/restore), auth-service (ban/unban),
 * interaction-service (comment removal). The rest are recorded in
 * moderation_actions and published to admin.moderation-events with no
 * subscriber, so the log says so rather than implying the action landed.
 */
export const ENFORCED: ModerationActionType[] = [
  "TAKEDOWN_VIDEO",
  "RESTORE_VIDEO",
  "BAN_USER",
  "UNBAN_USER",
  "REMOVE_COMMENT",
];

const DESTRUCTIVE: ModerationActionType[] = [
  "BAN_USER",
  "TAKEDOWN_VIDEO",
  "REMOVE_COMMENT",
  "WARN_USER",
];

const ENFORCEMENT_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "ENFORCED" as const, label: "Enforced" },
  { value: "RECORDED" as const, label: "Recorded only" },
];

type EnforcementFilter = (typeof ENFORCEMENT_FILTERS)[number]["value"];
type SortKey = "admin" | "action" | "target" | "createdAt";

export function ActionsTable({ actions }: { actions: ModerationActionResponse[] }) {
  const [query, setQuery] = useState("");
  const [actionType, setActionType] = useState<ModerationActionType | "ALL">("ALL");
  const [enforcement, setEnforcement] = useState<EnforcementFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "createdAt",
    asc: false,
  });

  // Only the types actually present — an empty filter option is a dead control.
  const types = useMemo(
    () => [...new Set(actions.map((a) => a.actionType))].sort(),
    [actions],
  );

  const belowXl = useBelowXl();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = actions.filter((action) => {
      if (actionType !== "ALL" && action.actionType !== actionType) return false;
      if (enforcement !== "ALL") {
        const enforced = ENFORCED.includes(action.actionType);
        if (enforcement === "ENFORCED" ? !enforced : enforced) return false;
      }
      if (!needle) return true;
      return (
        action.adminId.toLowerCase().includes(needle) ||
        action.actionType.toLowerCase().includes(needle) ||
        action.targetId.toLowerCase().includes(needle) ||
        action.targetType.toLowerCase().includes(needle) ||
        action.reason.toLowerCase().includes(needle) ||
        (action.reportId ?? "").toLowerCase().includes(needle)
      );
    });

    const direction = sort.asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "admin":
          return a.adminId.localeCompare(b.adminId) * direction;
        case "action":
          return a.actionType.localeCompare(b.actionType) * direction;
        case "target":
          return a.targetType.localeCompare(b.targetType) * direction;
        default:
          return a.createdAt.localeCompare(b.createdAt) * direction;
      }
    });
  }, [actions, query, actionType, enforcement, sort]);

  return (
    <Card>
      <CardHeader
        title="Recent Actions"
        hint="GET /api/v1/admin/actions"
        actions={
          <>
            <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
              />
            </label>
            <select
              value={actionType}
              onChange={(e) =>
                setActionType(e.target.value as ModerationActionType | "ALL")
              }
              aria-label="Filter by action type"
              className="rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[11px] text-ink-soft outline-none"
            >
              <option value="ALL">All actions</option>
              {types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Segmented
              options={ENFORCEMENT_FILTERS}
              value={enforcement}
              onChange={setEnforcement}
            />
          </>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[840px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SortableHeader label="Admin" sortKey="admin" sort={sort} onSort={setSort} className="hidden px-5 xl:table-cell" />
              <SortableHeader label="Action" sortKey="action" sort={sort} onSort={setSort} className="px-5 xl:px-3" />
              <SortableHeader label="Target" sortKey="target" sort={sort} onSort={setSort} />
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Reason</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Report</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Enforced</th>
              <SortableHeader
                label="When"
                sortKey="createdAt"
                sort={sort}
                onSort={setSort}
                className="px-5 text-right"
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((action) => {
              const expanded = expandedId === action.id;
              return (
                <Fragment key={action.id}>
                  <tr
                    {...(belowXl
                      ? expandableRowProps(
                          () => setExpandedId(expanded ? null : action.id),
                          expanded,
                        )
                      : {})}
                    className={cn(
                      "border-b border-line last:border-b-0 transition-colors hover:bg-surface-muted",
                      belowXl && "cursor-pointer",
                    )}
                  >
                    <td className="figure hidden px-5 py-3 whitespace-nowrap xl:table-cell">
                      #{shortId(action.adminId.slice(-8), 8)}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap xl:px-3">
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
                    <td className="hidden max-w-[240px] truncate px-3 py-3 xl:table-cell" title={action.reason}>
                      {action.reason}
                    </td>
                    <td className="figure hidden px-3 py-3 whitespace-nowrap text-ink-faint xl:table-cell">
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

                  {belowXl && expanded ? (
                    <RowDetail colSpan={7}>
                      <Field label="Admin">#{shortId(action.adminId.slice(-8), 8)}</Field>
                      <Field label="Action">{action.actionType}</Field>
                      <Field label="Target">
                        {action.targetType} · {action.targetId.slice(-8)}
                      </Field>
                      <Field label="Report">
                        {action.reportId ? `#${action.reportId.slice(-8)}` : "—"}
                      </Field>
                      <Field label="Reason" wide>
                        {action.reason}
                      </Field>
                      <Field label="Enforced">
                        {ENFORCED.includes(action.actionType) ? "yes" : "no consumer"}
                      </Field>
                      <Field label="When">{formatDate(action.createdAt)}</Field>
                    </RowDetail>
                  ) : null}
                </Fragment>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-faint">
                  No actions match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (sort: { key: SortKey; asc: boolean }) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-3 py-3", className)}>
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, asc: active ? !sort.asc : false })}
        className={cn(
          "label-caps inline-flex items-center gap-1 transition-colors hover:text-ink",
          active ? "text-ink" : "text-ink-soft",
        )}
      >
        {label}
        <ChevronsUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
