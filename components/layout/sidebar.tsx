"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "./brand-mark";
import { NAV_GROUPS } from "./nav-config";
import { UserBlock } from "./user-block";
import { Tooltip } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/lib/api/config";
import type { AdminSession } from "@/lib/api/session";
import { cn } from "@/lib/utils";

export function Sidebar({
  session,
  defaultCollapsed = false,
}: {
  session: AdminSession;
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [expandedPref, setExpandedPref] = useState(!defaultCollapsed);
  // Below lg the 256px sidebar eats a third of a tablet viewport, so the rail is
  // forced regardless of the stored preference — which is left untouched, so a
  // desktop window gets the sidebar back the way the user left it.
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const collapsed = narrow || !expandedPref;

  function toggle() {
    const next = !collapsed;
    setExpandedPref(!next);
    // One year, path=/ so every route agrees. Read back by app/(admin)/layout.tsx.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-sidebar text-sidebar-ink transition-[width] duration-200 ease-out",
        collapsed ? "w-[64px]" : "w-[256px]",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center",
          collapsed ? "justify-center px-2" : "gap-2 pr-2 pl-4",
        )}
      >
        {collapsed ? (
          narrow ? (
            // Forced rail: expanding is not on offer, so the mark is a plain mark, not a
            // control that looks clickable and does nothing.
            <span title="TikTok Admin">
              <BrandMark />
            </span>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-label="Expand sidebar"
              aria-expanded={false}
              title="Expand sidebar"
              className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-sidebar-raised"
            >
              <span className="transition-opacity group-hover:opacity-0">
                <BrandMark />
              </span>
              <PanelLeftOpen className="absolute h-4 w-4 text-sidebar-soft opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )
        ) : (
          <>
            {/* There is one console, so this is the way home rather than a switcher. */}
            <Link
              href="/dashboard"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5 pr-2"
            >
              <BrandMark />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold tracking-tight">
                  TikTok Admin
                </span>
                <span className="block text-[11px] text-sidebar-faint">
                  Moderation console
                </span>
              </span>
            </Link>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded
              title="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-faint transition-colors hover:bg-sidebar-raised hover:text-sidebar-ink"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto pt-2 pb-4 [&::-webkit-scrollbar]:hidden",
          collapsed ? "px-3" : "px-3",
        )}
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label} className="pb-4">
            {collapsed ? (
              groupIndex > 0 && (
                <div className="mx-2 mb-2 border-t border-sidebar-line" />
              )
            ) : (
              <p className="px-3 pb-1.5 text-[11px] font-medium text-sidebar-faint">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                // Collapsed, the label is gone from the DOM — the flyout carries it, and
                // aria-label keeps the link named for screen readers. Portal-rendered so
                // the scrolling nav does not clip it.
                const collapsedLabel = item.ready
                  ? item.label
                  : `${item.label} — backend endpoint not built yet`;
                const link = (
                  <Link
                    href={item.href}
                    aria-label={collapsed ? collapsedLabel : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center rounded-lg text-[13px] transition-colors",
                      collapsed ? "justify-center px-0" : "gap-3 px-3",
                      active
                        ? "bg-sidebar-raised font-medium text-sidebar-ink"
                        : "text-sidebar-soft hover:bg-sidebar-raised/70 hover:text-sidebar-ink",
                    )}
                  >
                    {active && !collapsed ? (
                      <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" />
                    ) : null}
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-accent" : "text-sidebar-faint",
                      )}
                    />
                    {collapsed ? (
                      !item.ready && (
                        <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-pending" />
                      )
                    ) : (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {!item.ready && (
                          <span
                            title="Backend endpoint not built yet"
                            className="rounded-full bg-sidebar-line px-1.5 py-0.5 text-[10px] text-sidebar-soft"
                          >
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip label={collapsedLabel} placement="right">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-sidebar-line",
          collapsed ? "p-3" : "p-3",
        )}
      >
        <UserBlock session={session} collapsed={collapsed} />
      </div>
    </aside>
  );
}
