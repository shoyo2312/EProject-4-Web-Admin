import { CalendarDays, ChevronDown, Download } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  showFilters = true,
}: {
  title: string;
  subtitle?: string;
  showFilters?: boolean;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-6">
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[12px] text-ink-soft">{subtitle}</p>
        ) : null}
      </div>

      {showFilters ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-surface-muted"
          >
            Daily
            <ChevronDown className="h-3.5 w-3.5 text-ink-faint" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-surface-muted"
          >
            <CalendarDays className="h-3.5 w-3.5 text-ink-faint" />
            13 Aug 2026
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12px] text-surface transition-opacity hover:opacity-85"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      ) : null}
    </div>
  );
}
