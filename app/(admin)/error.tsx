"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * What a page shows when something throws past its own handling. The calls each page makes on
 * the server already fall back to ErrorState; this is the rest — a render that broke, or a Load
 * more or a search whose server action failed. It sits inside the console's chrome, so the
 * sidebar still works, and Try again re-fetches this page alone.
 *
 * In production a server error's message is a generic one, and the digest is what matches it to
 * the server's log.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Card className="max-w-3xl px-6 py-6">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <h2 className="label text-ink">Something went wrong</h2>
        {error.digest ? (
          <code className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-soft">
            {error.digest}
          </code>
        ) : null}
      </div>

      <p className="mt-3 text-[13px] text-ink-soft">{error.message}</p>

      <button
        type="button"
        onClick={retry}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] text-ink-soft transition-colors hover:bg-surface-muted"
      >
        <RotateCw className="h-3.5 w-3.5" />
        Try again
      </button>
    </Card>
  );
}
