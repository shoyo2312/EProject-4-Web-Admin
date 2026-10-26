import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** The way back from a detail page to the list or the page it belongs to. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href as never}
      className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-ink-soft underline-offset-4 hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}
