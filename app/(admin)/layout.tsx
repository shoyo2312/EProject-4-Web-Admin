import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getNotifications, referenceNow } from "@/lib/api/admin";
import { NOTIFICATIONS_SEEN_COOKIE, SIDEBAR_COOKIE, USE_MOCK } from "@/lib/api/config";
import { getSessionProfile } from "@/lib/api/session";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const [session, jar, notifications] = await Promise.all([
    getSessionProfile(),
    cookies(),
    // The bell is on every page; a service being down must not take every page with it.
    getNotifications().catch(() => null),
  ]);
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const notificationsSeenAt = Number(jar.get(NOTIFICATIONS_SEEN_COOKIE)?.value) || 0;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar session={session} defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          session={session}
          usingMockData={USE_MOCK}
          notifications={notifications}
          notificationsSeenAt={notificationsSeenAt}
          now={referenceNow()}
        />
        {/* Live data only: mock pages have nothing to re-fetch. */}
        {USE_MOCK ? null : <AutoRefresh />}
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
