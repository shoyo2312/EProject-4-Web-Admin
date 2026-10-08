import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";

/** A URL no page answers to. It gets the root layout only, so it stands alone like the sign-in page. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <Card className="w-full max-w-[380px] px-5 py-6 text-center">
        <SearchX className="mx-auto h-5 w-5 text-ink-faint" />
        <h1 className="mt-3 text-[16px] font-bold">Page not found</h1>
        <p className="mt-1 text-[12px] text-ink-soft">Nothing in the console lives at this address.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-surface-muted"
        >
          Back to the dashboard
        </Link>
      </Card>
    </div>
  );
}
