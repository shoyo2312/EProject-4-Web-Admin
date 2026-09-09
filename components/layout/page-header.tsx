import { Suspense } from "react";
import { ExportCsvButton, type CsvExport } from "./export-csv-button";
import { HeaderFilters, type HeaderFilterConfig } from "./header-filters";

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
   * The rows this page already fetched. Export runs entirely in the browser off
   * that data, so what downloads is exactly what the page is showing — no second
   * request that could come back with a different page of results.
   */
  csv?: CsvExport;
}) {
  return (
    <div className="mb-5 flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[12px] text-ink-soft">{subtitle}</p>
        ) : null}
      </div>

      {filters || csv ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto">
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
