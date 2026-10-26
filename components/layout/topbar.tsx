"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CommandPalette } from "./command-palette";
import { resolveCrumb } from "./nav-config";
import { NotificationBell } from "./notification-bell";
import { ThemeToggle } from "./theme-toggle";
import type { AdminNotification } from "@/lib/notifications";

export function Topbar({
  usingMockData,
  notifications,
  notificationsSeenAt,
  now,
  dark,
}: {
  usingMockData: boolean;
  notifications: AdminNotification[] | null;
  notificationsSeenAt: number;
  now: number;
  dark: boolean;
}) {
  const pathname = usePathname();
  const crumb = resolveCrumb(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur-md md:gap-6 md:px-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <span className="truncate text-ink-faint">{crumb.section}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        <span className="truncate font-medium text-ink">{crumb.page}</span>
      </nav>

      {/* Who is signed in, and signing out, live at the foot of the sidebar on every width. */}
      <div className="flex min-w-0 items-center gap-1.5">
        {usingMockData ? (
          <span
            title="ADMIN_USE_MOCK is not set to false — no service is being called"
            className="mr-1 inline-flex rounded-full bg-pending-bg px-2.5 py-1 text-[11px] font-medium text-pending"
          >
            Mock data
          </span>
        ) : null}
        <CommandPalette />
        <ThemeToggle initialDark={dark} />
        <NotificationBell items={notifications} seenAt={notificationsSeenAt} now={now} />
      </div>
    </header>
  );
}
