import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Block, Bone } from "@/components/ui/skeleton";

const LINK = "mb-3 inline-flex items-center gap-1.5 text-[12px]";

/** The way back from a detail page to the list or the page it belongs to. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href as never} className={`${LINK} text-ink-soft underline-offset-4 hover:underline`}>
      <ArrowLeft className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}

/** The back link while its page loads: the same line, so the header under it does not move. */
export function BackLinkSkeleton({ width }: { width: string }) {
  return (
    <span className={LINK}>
      <Block className="h-3.5 w-3.5 rounded" />
      <span>
        <Bone className={width} />
      </span>
    </span>
  );
}
