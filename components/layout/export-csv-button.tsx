"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toCsv, csvFilename, type CsvRow } from "@/lib/csv";

export type CsvExport = {
  /** Base filename; the date is appended. */
  name: string;
  rows: CsvRow[];
  /** Explicit column order and subset. Defaults to every key found in the rows. */
  columns?: string[];
};

export function ExportCsvButton({ name, rows, columns }: CsvExport) {
  const [done, setDone] = useState(false);
  const empty = rows.length === 0;

  function download() {
    // A BOM, because Excel reads a UTF-8 CSV as the local 8-bit codepage without one
    // and mangles every non-ASCII username.
    const blob = new Blob(["﻿" + toCsv(rows, columns)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = csvFilename(name);
    link.click();
    // Revoking immediately can cancel the download in Safari; one frame is enough.
    requestAnimationFrame(() => URL.revokeObjectURL(url));

    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={empty}
      title={empty ? "Nothing to export on this page" : `Export ${rows.length} rows`}
      className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[12px] text-surface transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download className="h-3.5 w-3.5" />
      {done ? "Downloaded" : "Export CSV"}
    </button>
  );
}
