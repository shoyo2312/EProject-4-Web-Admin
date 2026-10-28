import { Suspense } from "react";
import { Block, Ghost } from "@/components/ui/skeleton";
import { ExportCsvButton, type CsvExport } from "./export-csv-button";
import { HeaderFilters, type HeaderFilterConfig } from "./header-filters";

/* Shared with the skeleton below, so the two cannot drift apart. */
const ROW = "mb-6 flex flex-col items-start gap-4 md:flex-row md:items-end md:justify-between md:gap-6";
const TITLE = "text-[24px] leading-tight font-semibold tracking-tight";
const SUBTITLE = "mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-soft";
const CONTROLS = "flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto";

export function PageHeader({
  title,
  subtitle,
  filters,
  csv,
}: {
  title: string;
  subtitle?: string;
  /**
   * Omitted on pages with nothing to filter — an error state, or a screen with no
   * dated data. A control that cannot change what is on screen should not be drawn.
   */
  filters?: HeaderFilterConfig;
  /**
   * The rows this page already fetched, written in the browser — what downloads is exactly
   * what is on screen. A paged listing passes `all` as well, and then every row its filters
   * match is read on the server instead.
   */
  csv?: CsvExport;
}) {
  return (
    <div className={ROW}>
      <div className="min-w-0">
        <h1 className={TITLE}>{title}</h1>
        {subtitle ? <p className={SUBTITLE}>{subtitle}</p> : null}
      </div>

      {filters || csv ? (
        <div className={CONTROLS}>
          {/* useSearchParams opts the subtree into client rendering; the boundary keeps
              that from forcing the whole page out of static generation. */}
          {filters ? (
            <Suspense fallback={null}>
              <HeaderFilters {...filters} />
            </Suspense>
          ) : null}
          {csv ? <ExportCsvButton {...csv} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The header while its page loads. `title` and `subtitle` are the page's own words, or a sample as
 * long as they run: never shown, only laid out, so every line breaks where the real one will at
 * any width. `filters` and `csv` stand for the period picker and the export button.
 */
export function PageHeaderSkeleton({
  title,
  subtitle,
  filters,
  csv,
}: {
  title: string;
  subtitle?: string;
  filters?: boolean;
  csv?: boolean;
}) {
  return (
    <div className={ROW}>
      <div className="min-w-0">
        <h1 className={TITLE}>
          <Ghost>{title}</Ghost>
        </h1>
        {subtitle ? (
          <p className={SUBTITLE}>
            <Ghost>{subtitle}</Ghost>
          </p>
        ) : null}
      </div>

      {filters || csv ? (
        <div className={CONTROLS}>
          {filters ? (
            <>
              <Block className="h-[38px] w-[85px] rounded-lg" />
              <Block className="h-[38px] w-[120px] rounded-lg" />
            </>
          ) : null}
          {csv ? <Block className="h-9 w-[113px] rounded-lg" /> : null}
        </div>
      ) : null}
    </div>
  );
}
