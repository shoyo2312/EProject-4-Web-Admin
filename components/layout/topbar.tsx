"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Inbox, Search } from "lucide-react";
import { resolveCrumb } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import type { AdminSession } from "@/lib/api/session";
import type { AdminNotification } from "@/lib/notifications";

export function Topbar({
  session,
  usingMockData,
  notifications,
  notificationsSeenAt,
  now,
}: {
  session: AdminSession;
  usingMockData: boolean;
  notifications: AdminNotification[] | null;
  notificationsSeenAt: number;
  now: number;
}) {
  const pathname = usePathname();
  const crumb = resolveCrumb(pathname);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:gap-6 md:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="truncate text-ink-faint">{crumb.section}</span>
        <ChevronRight className="h-3.5 w-3.5 text-ink-faint" />
        <span className="truncate font-semibold">{crumb.page}</span>
      </nav>

      <div className="flex min-w-0 items-center gap-2">
        {usingMockData ? (
          <span
            title="ADMIN_USE_MOCK is not set to false — no service is being called"
            className="label-caps rounded-md border border-pending/30 bg-pending-bg px-2 py-1.5 text-pending"
          >
            Mock data
          </span>
        ) : null}
        <label className="hidden w-[200px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2 sm:flex lg:w-[320px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <input
            type="search"
            placeholder="Search reports, users, videos..."
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-ink-faint"
          />
          <kbd className="hidden items-center gap-0.5 lg:flex rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-faint">
            ⌘ K
          </kbd>
        </label>

        <NotificationBell items={notifications} seenAt={notificationsSeenAt} now={now} />
        <button
          type="button"
          aria-label="Inbox"
          className="hidden h-9 w-9 md:flex items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-surface-muted"
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
