"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";
import { exportCsvAction } from "@/app/(admin)/actions";
import { EXPORT_MAX_ROWS, toCsv, csvFilename, type CsvRow, type ExportDataset } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import type { ListParams } from "@/lib/list-filters";

export type CsvExport = {
  /** Base filename; the date is appended. */
  name: string;
  rows: CsvRow[];
  /** Explicit column order and subset. Defaults to every key found in the rows. */
  columns?: string[];
  /**
   * Set on a paged listing: the button then writes every row the page's filters match, read
   * server-side a page at a time, instead of the one page on screen.
   */
  all?: { dataset: ExportDataset; params: ListParams; total: number };
};

function save(csv: string, filename: string) {
  // A BOM, because Excel reads a UTF-8 CSV as the local 8-bit codepage without one
  // and mangles every non-ASCII username.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking immediately can cancel the download in Safari; one frame is enough.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}

export function ExportCsvButton({ name, rows, columns, all }: CsvExport) {
  const [outcome, setOutcome] = useState<{ ok: boolean; message?: string } | null>(null);
  const [exporting, startExport] = useTransition();
  const count = all ? all.total : rows.length;

  function settle(next: { ok: boolean; message?: string }) {
    setOutcome(next);
    window.setTimeout(() => setOutcome(null), next.ok ? 2000 : 5000);
  }

  function download() {
    if (!all) {
      save(toCsv(rows, columns), csvFilename(name));
      settle({ ok: true });
      return;
    }
    startExport(async () => {
      const result = await exportCsvAction(all.dataset, all.params);
      if (result.ok) {
        save(result.csv, result.filename);
        settle({ ok: true });
      } else {
        settle({ ok: false, message: result.message });
      }
    });
  }

  const title =
    outcome && !outcome.ok
      ? `Export failed: ${outcome.message}`
      : count === 0
        ? "Nothing to export"
        : !all
          ? `Export ${formatNumber(count)} rows`
          : count > EXPORT_MAX_ROWS
            ? `Export the first ${formatNumber(EXPORT_MAX_ROWS)} of ${formatNumber(count)} matching rows`
            : `Export all ${formatNumber(count)} matching rows, not just this page`;

  return (
    <button
      type="button"
      onClick={download}
      disabled={count === 0 || exporting}
      title={title}
      className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12px] text-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" />
      {exporting
        ? "Exporting…"
        : outcome
          ? outcome.ok
            ? "Downloaded"
            : "Export failed"
          : "Export CSV"}
    </button>
  );
}
