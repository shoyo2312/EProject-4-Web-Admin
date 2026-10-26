import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";

/**
 * The two public screens share one frame: the console's dark rail, widened into a panel that
 * says what this is, and the form beside it. On a phone the panel folds down to the mark alone.
 */
export function AuthShell({
  title,
  lead,
  foot,
  children,
}: {
  title: string;
  lead: string;
  foot: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-[42%] max-w-[560px] flex-col justify-between bg-sidebar p-10 text-sidebar-ink lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span>
            <span className="block text-[14px] font-semibold tracking-tight">TikTok Admin</span>
            <span className="block text-[11px] text-sidebar-faint">Moderation console</span>
          </span>
        </div>
        <div>
          <p className="max-w-sm text-[30px] leading-tight font-semibold tracking-tight">
            Everything waiting on a moderator, in one place.
          </p>
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-sidebar-soft">
            Reports, held uploads, accounts and the queues behind them. Every decision made here
            is written to the audit log.
          </p>
        </div>
        <p className="text-[12px] text-sidebar-faint">Internal use only.</p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-[14px] font-semibold tracking-tight">TikTok Admin</span>
          </div>
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{lead}</p>
          <div className="mt-7">{children}</div>
          <p className="mt-8 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
            {foot}
          </p>
        </div>
      </main>
    </div>
  );
}
