import { cookies } from "next/headers";
import { LiveRefresh } from "@/components/layout/live-refresh";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getNotifications } from "@/lib/api/notifications";
import { referenceNow } from "@/lib/api/shared";
import {
  NOTIFICATIONS_SEEN_COOKIE,
  SIDEBAR_COOKIE,
  THEME_COOKIE,
  USE_MOCK,
} from "@/lib/api/config";
import { getSessionProfile } from "@/lib/api/session";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const [session, jar, notifications] = await Promise.all([
    getSessionProfile(),
    cookies(),
    // The bell is on every page; a service being down must not take every page with it.
    getNotifications().catch(() => null),
  ]);
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const dark = jar.get(THEME_COOKIE)?.value === "dark";
  const notificationsSeenAt = Number(jar.get(NOTIFICATIONS_SEEN_COOKIE)?.value) || 0;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar session={session} defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          usingMockData={USE_MOCK}
          notifications={notifications}
          notificationsSeenAt={notificationsSeenAt}
          now={referenceNow()}
          dark={dark}
        />
        {/* Live data only: mock pages have nothing to re-fetch. */}
        {USE_MOCK ? null : <LiveRefresh />}
        <main className="mx-auto w-full max-w-[1480px] min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
