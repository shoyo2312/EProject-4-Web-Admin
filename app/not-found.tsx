import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";

/** A URL no page answers to. It gets the root layout only, so it stands alone like the sign-in page. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <Card className="w-full max-w-[400px] px-6 py-8 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-ink-faint">
          <SearchX className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[18px] font-semibold tracking-tight">Page not found</h1>
        <p className="mt-1.5 text-[13px] text-ink-soft">Nothing in the console lives at this address.</p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Back to the dashboard
        </Link>
      </Card>
    </div>
  );
}
