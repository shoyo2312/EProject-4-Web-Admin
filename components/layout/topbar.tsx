"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Inbox, Search } from "lucide-react";
import { ROUTE_TITLES } from "./nav-config";
import type { AdminSession } from "@/lib/api/session";

export function Topbar({
  session,
  usingMockData,
}: {
  session: AdminSession;
  usingMockData: boolean;
}) {
  const pathname = usePathname();
  const crumb = ROUTE_TITLES[pathname] ?? { section: "Dashboard", page: "Overview" };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-6 border-b border-line bg-surface px-6 py-3">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]">
        <span className="text-ink-faint">{crumb.section}</span>
        <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
        <span className="font-semibold">{crumb.page}</span>
      </nav>

      <div className="flex items-center gap-2">
        {usingMockData ? (
          <span
            title="ADMIN_USE_MOCK is not set to false — no service is being called"
            className="label-caps rounded-md border border-pending/30 bg-pending-bg px-2 py-1.5 text-pending"
          >
            Mock data
          </span>
        ) : null}
        <label className="flex w-[320px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <input
            type="search"
            placeholder="Search reports, users, videos..."
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="flex items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-faint">
            ⌘ K
          </kbd>
        </label>

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-muted"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-2 h-1.5 w-1.5 rounded-full bg-pending" />
        </button>
        <button
          type="button"
          aria-label="Inbox"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-muted"
        >
          <Inbox className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-[11px] font-semibold text-surface"
        >
          {session.initials}
        </button>
      </div>
    </header>
  );
}
