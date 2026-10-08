"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { resolveCrumb } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import type { AdminNotification } from "@/lib/notifications";

export function Topbar({
  usingMockData,
  notifications,
  notificationsSeenAt,
  now,
}: {
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

      {/* Who is signed in, and signing out, live at the foot of the sidebar on every width. */}
      <div className="flex min-w-0 items-center gap-2">
        {usingMockData ? (
          <span
            title="ADMIN_USE_MOCK is not set to false — no service is being called"
            className="label-caps rounded-md border border-pending/30 bg-pending-bg px-2 py-1.5 text-pending"
          >
            Mock data
          </span>
        ) : null}
        <CommandPalette />
        <NotificationBell items={notifications} seenAt={notificationsSeenAt} now={now} />
      </div>
    </header>
  );
}
