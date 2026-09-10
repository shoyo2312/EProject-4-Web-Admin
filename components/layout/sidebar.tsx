"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
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
  // Below lg the 260px sidebar eats a third of a tablet viewport, so the rail is
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
        "sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {/* Workspace switcher + collapse toggle. Collapsed, the logo *is* the toggle —
          two stacked buttons in 68px reads as clutter. */}
      <div className="flex items-center gap-1.5 p-3">
        {collapsed && narrow ? (
          // Forced rail: expanding is not on offer, so the logo is a plain mark,
          // not a control that looks clickable and does nothing.
          <span
            title="TikTok Admin"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-surface">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </span>
        ) : collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            title="Expand sidebar"
            className="group relative flex h-10 w-10 items-center justify-center rounded-lg border border-line transition-colors hover:bg-surface-muted"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-surface transition-opacity group-hover:opacity-0">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <PanelLeftOpen className="absolute h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink text-surface">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] tracking-wider text-ink-faint">
                  Console
                </span>
                <span className="block truncate text-[13px] font-semibold">
                  TikTok Admin
                </span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
            </button>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded
              title="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <nav
        className={cn(
          "flex-1 overflow-y-auto pb-4",
          collapsed ? "px-2.5" : "px-3",
        )}
      >
        {NAV_GROUPS.map((group, groupIndex) => (
          <div
            key={group.label}
            className={cn("py-3", groupIndex > 0 && "border-t border-line")}
          >
            {/* Collapsed, the group border carries the grouping on its own. */}
            {!collapsed && (
              <p className="px-2 pb-2 text-[11px] text-ink-faint">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                      className={cn(
                        "relative flex items-center rounded-lg py-2 text-[13px] transition-colors",
                        collapsed
                          ? "justify-center px-0"
                          : "gap-2.5 px-2.5",
                        active
                          ? "bg-ink font-medium text-surface"
                          : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {collapsed ? (
                        !item.ready && (
                          <span
                            className={cn(
                              "absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full",
                              active ? "bg-surface/60" : "bg-pending",
                            )}
                          />
                        )
                      ) : (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {!item.ready && (
                            <span
                              title="Backend endpoint not built yet"
                              className={cn(
                                "rounded px-1 py-0.5 text-[9px] tracking-wide",
                                active
                                  ? "bg-surface/20 text-surface"
                                  : "bg-surface-muted text-ink-faint",
                              )}
                            >
                              SOON
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

      <div className={cn("border-t border-line", collapsed ? "p-2.5" : "p-3")}>
        <UserBlock session={session} collapsed={collapsed} />
      </div>
    </aside>
  );
}
