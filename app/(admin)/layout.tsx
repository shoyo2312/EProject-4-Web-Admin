import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/layout/auto-refresh";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SIDEBAR_COOKIE, USE_MOCK } from "@/lib/api/config";
import { getSessionProfile } from "@/lib/api/session";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const [session, jar] = await Promise.all([getSessionProfile(), cookies()]);
  const collapsed = jar.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar session={session} defaultCollapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} usingMockData={USE_MOCK} />
        {/* Live data only: mock pages have nothing to re-fetch. */}
        {USE_MOCK ? null : <AutoRefresh />}
        <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
