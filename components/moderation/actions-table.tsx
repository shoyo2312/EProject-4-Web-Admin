"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown, Search, X } from "lucide-react";
import { actionRowDetailAction } from "@/app/(admin)/moderation/actions/actions";
import { TargetPreviewLine } from "@/components/moderation/target-preview-line";
import { TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import type { ModerationActionResponse, ModerationActionType } from "@/lib/api/types";
import { formatDateTime, relativeTime, shortId } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/labels";
import { ACTION_TYPES } from "@/lib/list-filters";
import { ENFORCED } from "@/lib/moderation";
import { NO_NAMES, targetName, type RowNames } from "@/lib/names";
import { hrefWith } from "@/lib/url";
import { useBelowXl } from "@/lib/use-below-xl";
import { useRowDetail } from "@/lib/use-row-detail";
import { cn } from "@/lib/utils";

const DESTRUCTIVE: ModerationActionType[] = [
  "BAN_USER",
  "TAKEDOWN_VIDEO",
  "PURGE_VIDEO",
  "REMOVE_COMMENT",
  "WARN_USER",
];

const ENFORCEMENT_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "ENFORCED" as const, label: "Enforced" },
  { value: "RECORDED" as const, label: "Recorded only" },
];

type EnforcementFilter = (typeof ENFORCEMENT_FILTERS)[number]["value"];

/** The admin's @handle, or the tail of their id when user-service could not name them. */
function adminName(names: RowNames, adminId: string): string {
  return names.handles[adminId] ?? `#${shortId(adminId.slice(-8), 8)}`;
}
type SortKey = "admin" | "action" | "target" | "createdAt";

export function ActionsTable({
  actions,
  names = NO_NAMES,
  adminId,
  actionType,
}: {
  actions: ModerationActionResponse[];
  /** Admins and targets by name, resolved by the page in one batch each. */
  names?: RowNames;
  /** The server-side filters the page was fetched with, so the controls show them. */
  adminId?: string;
  actionType?: ModerationActionType;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startNavigation] = useTransition();
  const [query, setQuery] = useState("");
  const [enforcement, setEnforcement] = useState<EnforcementFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "createdAt",
    asc: false,
  });

  // Back to the first page: page 3 of everything is not page 3 of one admin's actions.
  const filterHref = (patch: Record<string, string | null>) =>
    hrefWith(pathname, params, { ...patch, page: null });

  const belowXl = useBelowXl();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = actions.filter((action) => {
      if (enforcement !== "ALL") {
        const enforced = ENFORCED.includes(action.actionType);
        if (enforcement === "ENFORCED" ? !enforced : enforced) return false;
      }
      if (!needle) return true;
      return [
        action.adminId,
        names.handles[action.adminId] ?? "",
        ACTION_LABELS[action.actionType],
        action.targetId,
        action.targetType,
        targetName(names, action.targetType, action.targetId) ?? "",
        action.reason,
        action.reportId ?? "",
      ].some((field) => field.toLowerCase().includes(needle));
    });

    const direction = sort.asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "admin":
          return adminName(names, a.adminId).localeCompare(adminName(names, b.adminId)) * direction;
        case "action":
          return ACTION_LABELS[a.actionType].localeCompare(ACTION_LABELS[b.actionType]) * direction;
        case "target":
          return a.targetType.localeCompare(b.targetType) * direction;
        default:
          return a.createdAt.localeCompare(b.createdAt) * direction;
      }
    });
  }, [actions, names, query, enforcement, sort]);

  return (
    <Card>
      <CardHeader
        title="Recent Actions"
        hint="Every moderation decision in the selected period. The action-type and admin filters cover the whole log; the search box, the tabs and sorting cover this page."
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
            {adminId ? (
              <Link
                href={filterHref({ admin: null }) as never}
                title="Show every admin's actions"
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[11px] text-ink-soft hover:text-ink"
              >
                {adminName(names, adminId)}
                <X className="h-3 w-3" />
              </Link>
            ) : null}
            <select
              value={actionType ?? "ALL"}
              onChange={(e) => {
                const next = e.target.value;
                startNavigation(() =>
                  router.replace(filterHref({ type: next === "ALL" ? null : next }) as never),
                );
              }}
              aria-label="Filter by action type"
              className="rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[11px] text-ink-soft outline-none"
            >
              <option value="ALL">All actions</option>
              {ACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACTION_LABELS[type]}
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
              <th className="label-caps px-3 py-3 text-ink-soft">Effect</th>
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
            {rows.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                admin={adminName(names, action.adminId)}
                target={targetName(names, action.targetType, action.targetId)}
                belowXl={belowXl}
                adminHref={adminId ? null : filterHref({ admin: action.adminId })}
              />
            ))}

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

function ActionRow({
  action,
  admin,
  target: targetLabel,
  belowXl,
  adminHref,
}: {
  action: ModerationActionResponse;
  /** The admin's @handle, or the tail of their id when it could not be resolved. */
  admin: string;
  /** The target's @handle or video title; null shows the tail of its id. */
  target: string | null;
  /** Below xl the secondary columns are dropped, so the expand row carries them instead. */
  belowXl: boolean;
  /** The log narrowed to this row's admin; null when it already is. */
  adminHref: string | null;
}) {
  const detail = useRowDetail(() => actionRowDetailAction(action.targetType, action.targetId));

  return (
    <Fragment>
      <tr
        {...expandableRowProps(detail.toggle, detail.open)}
        className="cursor-pointer border-b border-line last:border-b-0 transition-colors hover:bg-surface-muted"
      >
        <td className="hidden px-5 py-3 whitespace-nowrap xl:table-cell">{admin}</td>
        <td className="px-5 py-3 whitespace-nowrap xl:px-3">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[11px]",
              DESTRUCTIVE.includes(action.actionType)
                ? "border-danger/25 bg-danger-bg text-danger"
                : "border-line bg-surface-muted text-ink-soft",
            )}
          >
            {ACTION_LABELS[action.actionType]}
          </span>
        </td>
        <td className="px-3 py-3">
          <TargetBadge type={action.targetType} id={action.targetId} name={targetLabel} />
        </td>
        <td className="hidden max-w-[240px] truncate px-3 py-3 xl:table-cell" title={action.reason}>
          {action.reason}
        </td>
        <td className="figure hidden px-3 py-3 whitespace-nowrap text-ink-faint xl:table-cell">
          {action.reportId ? `#${action.reportId.slice(-8)}` : "—"}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          {/* A dismissal is only a record — nothing downstream acts on it — which is not a
              warning sign, so it reads plain rather than amber. */}
          {ENFORCED.includes(action.actionType) ? (
            <span className="text-success">Enforced</span>
          ) : (
            <span className="text-ink-faint">Recorded only</span>
          )}
        </td>
        <td className="px-5 py-3 text-right whitespace-nowrap text-ink-faint">
          {relativeTime(action.createdAt)}
        </td>
      </tr>

      {detail.open ? (
        <RowDetail colSpan={7}>
          {belowXl ? (
            <>
              <Field label="Action">{ACTION_LABELS[action.actionType]}</Field>
              <Field label="Report">
                {action.reportId ? `#${action.reportId.slice(-8)}` : "—"}
              </Field>
              <Field label="Reason" wide>
                {action.reason}
              </Field>
              <Field label="Effect">
                {ENFORCED.includes(action.actionType) ? "Enforced" : "Recorded only"}
              </Field>
            </>
          ) : null}

          <Field label="Admin">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>{admin}</span>
              {adminHref ? (
                <Link
                  href={adminHref as never}
                  className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  only this admin →
                </Link>
              ) : null}
            </span>
          </Field>
          <Field label="When">{formatDateTime(action.createdAt)}</Field>

          {/* What the action was actually done to. A target with no preview is still worth
              showing as such: a taken-down video or a deleted account resolves to nothing, and
              that absence is itself information the admin reading the log needs. */}
          <Field label="Target" wide>
            <TargetPreviewLine
              preview={detail.data?.preview ?? null}
              loading={detail.loading}
              failed={detail.failed}
              missing={`${action.targetType} · ${action.targetId.slice(-8)} — not found (deleted or unavailable)`}
              onRetry={detail.retry}
            />
          </Field>
        </RowDetail>
      ) : null}
    </Fragment>
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
