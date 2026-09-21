import {
  FileClock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Settings,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: Route;
  icon: LucideIcon;
  /**
   * Phase 1 wires the screens that admin-service / analytics-service already expose.
   * The rest are shells until their backend endpoints exist.
   */
  ready?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, ready: true },
      { label: "Analytics", href: "/analytics", icon: TrendingUp, ready: true },
    ],
  },
  {
    label: "Moderation",
    items: [
      { label: "Reports Queue", href: "/moderation/reports", icon: Flag, ready: true },
      { label: "Audit Log", href: "/moderation/actions", icon: FileClock, ready: true },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Users", href: "/users", icon: Users, ready: true },
      { label: "Videos", href: "/videos", icon: Video, ready: true },
      { label: "Comments", href: "/comments", icon: MessageSquare, ready: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Queues & DLQ", href: "/system/queues", icon: Radio },
      { label: "Settings", href: "/settings", icon: Settings, ready: true },
    ],
  },
];

/** Breadcrumb source of truth, so every page label lives in one place. */
export const ROUTE_TITLES: Record<string, { section: string; page: string }> = {
  "/dashboard": { section: "Dashboard", page: "Overview" },
  "/analytics": { section: "Dashboard", page: "Analytics" },
  "/moderation/reports": { section: "Moderation", page: "Reports Queue" },
  "/moderation/actions": { section: "Moderation", page: "Audit Log" },
  "/users": { section: "Management", page: "Users" },
  "/videos": { section: "Management", page: "Videos" },
  "/comments": { section: "Management", page: "Comments" },
  "/system/queues": { section: "System", page: "Queues & DLQ" },
  "/settings": { section: "System", page: "Settings" },
};

/**
 * The breadcrumb for a path, falling back to its parent's.
 *
 * A detail route — /users/123, /videos/abc — has no entry of its own and never will: the id is
 * a row, not a page worth naming here. Without the fallback it hits the default and the
 * breadcrumb reads "Dashboard / Overview" while the screen is showing an account.
 */
export function resolveCrumb(pathname: string): { section: string; page: string } {
  const exact = ROUTE_TITLES[pathname];
  if (exact) return exact;
  const parent = pathname.slice(0, pathname.lastIndexOf("/"));
  return ROUTE_TITLES[parent] ?? { section: "Dashboard", page: "Overview" };
}
