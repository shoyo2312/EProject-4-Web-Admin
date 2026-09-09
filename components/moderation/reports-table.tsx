"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, MoreHorizontal, Search } from "lucide-react";
import { StatusBadge, TargetBadge } from "@/components/ui/badge";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { ReportResponse, ReportStatus } from "@/lib/api/types";
import { MOCK_REPORTER_HANDLES } from "@/lib/mock/moderation";
import { relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = ReportStatus | "ALL";
type SortKey = "id" | "target" | "status" | "createdAt";

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  { value: "PENDING" as const, label: "Pending" },
  { value: "RESOLVED" as const, label: "Resolved" },
  { value: "DISMISSED" as const, label: "Dismissed" },
];

export function ReportsTable({
  reports,
  limit,
  footerHref,
}: {
  reports: ReportResponse[];
  /** Dashboard shows a slice; the Reports Queue page shows everything. */
  limit?: number;
  footerHref?: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "createdAt",
    asc: false,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = reports.filter((report) => {
      if (status !== "ALL" && report.status !== status) return false;
      if (!needle) return true;
      const handle = MOCK_REPORTER_HANDLES[report.reporterId] ?? "";
      return (
        report.id.includes(needle) ||
        report.targetId.includes(needle) ||
        report.targetType.toLowerCase().includes(needle) ||
        report.reason.toLowerCase().includes(needle) ||
        handle.toLowerCase().includes(needle)
      );
    });

    const direction = sort.asc ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "id":
          return a.id.localeCompare(b.id) * direction;
        case "target":
          return a.targetType.localeCompare(b.targetType) * direction;
        case "status":
          return a.status.localeCompare(b.status) * direction;
        default:
          return a.createdAt.localeCompare(b.createdAt) * direction;
      }
    });

    return limit ? sorted.slice(0, limit) : sorted;
  }, [reports, query, status, sort, limit]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader
        title="Reports Queue"
        hint="GET /api/v1/admin/reports — resolve writes a moderation action and emits a Kafka event"
        actions={
          <>
            <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
              />
            </label>
            <Segmented
              options={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
            />
            <CardMenuButton />
          </>
        }
      />

      {selected.size > 0 ? (
        <div className="flex items-center justify-between border-b border-line bg-surface-muted px-5 py-2.5">
          <span className="text-[11px] text-ink-soft">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] transition-colors hover:bg-canvas"
            >
              Dismiss
            </button>
            <button
              type="button"
              className="rounded-md bg-ink px-2.5 py-1.5 text-[11px] text-surface transition-opacity hover:opacity-85"
            >
              Resolve
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all reports"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 accent-[var(--ink)]"
                />
              </th>
              <SortableHeader label="ID" sortKey="id" sort={sort} onSort={setSort} />
              <th className="label-caps px-3 py-3 text-ink-soft">Reporter</th>
              <SortableHeader
                label="Target"
                sortKey="target"
                sort={sort}
                onSort={setSort}
              />
              <th className="label-caps px-3 py-3 text-ink-soft">Reason</th>
              <SortableHeader
                label="Status"
                sortKey="status"
                sort={sort}
                onSort={setSort}
              />
              <SortableHeader
                label="Created"
                sortKey="createdAt"
                sort={sort}
                onSort={setSort}
              />
              <th className="label-caps px-5 py-3 text-right text-ink-soft">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => {
              const isChecked = selected.has(report.id);
              return (
                <tr
                  key={report.id}
                  className={cn(
                    "border-b border-line last:border-b-0 transition-colors hover:bg-surface-muted",
                    // Closed reports recede — the queue is about what still needs work
                    report.status !== "PENDING" && "text-ink-faint",
                  )}
                >
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select report ${report.id}`}
                      checked={isChecked}
                      onChange={() => toggleOne(report.id)}
                      className="h-3.5 w-3.5 accent-[var(--ink)]"
                    />
                  </td>
                  <td className="figure px-3 py-3 whitespace-nowrap">
                    #{shortId(report.id.slice(-8), 8)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {/* Live data carries only a reporterId — user-service has no batch
                        handle lookup yet, so fall back to the id tail. */}
                    {MOCK_REPORTER_HANDLES[report.reporterId]
                      ? `@${MOCK_REPORTER_HANDLES[report.reporterId]}`
                      : `#${report.reporterId.slice(-6)}`}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <TargetBadge type={report.targetType} id={report.targetId} />
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-3" title={report.reason}>
                    {report.reason}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={report.status} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
                    {relativeTime(report.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Actions for report ${report.id}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:bg-surface"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink-faint">
                  No reports match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {footerHref ? (
        <div className="border-t border-line px-5 py-3 text-right">
          <Link
            href={footerHref as never}
            className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
          >
            View full queue →
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; asc: boolean };
  onSort: (sort: { key: SortKey; asc: boolean }) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th className="px-3 py-3">
      <button
        type="button"
        onClick={() => onSort({ key: sortKey, asc: active ? !sort.asc : false })}
        className={cn(
          "label-caps flex items-center gap-1 transition-colors hover:text-ink",
          active ? "text-ink" : "text-ink-soft",
        )}
      >
        {label}
        <ChevronsUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}
