import {
  FileClock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Radio,
  ScanEye,
  Settings,
  Trash2,
  TrendingUp,
  Users,
  Video,
  WholeWord,
} from "lucide-react";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { ancestors } from "@/lib/url";

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
      { label: "Video Review", href: "/moderation/review", icon: ScanEye, ready: true },
      { label: "Audit Log", href: "/moderation/actions", icon: FileClock, ready: true },
      { label: "Terms", href: "/moderation/terms", icon: WholeWord, ready: true },
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
      { label: "Queues & DLQ", href: "/system/queues", icon: Radio, ready: true },
      { label: "Settings", href: "/settings", icon: Settings, ready: true },
      { label: "Trash", href: "/trash", icon: Trash2, ready: true },
    ],
  },
];

/** Breadcrumb source of truth, so every page label lives in one place. */
export const ROUTE_TITLES: Record<string, { section: string; page: string }> = {
  "/dashboard": { section: "Dashboard", page: "Overview" },
  "/analytics": { section: "Dashboard", page: "Analytics" },
  "/notifications": { section: "Dashboard", page: "Notifications" },
  "/moderation/reports": { section: "Moderation", page: "Reports Queue" },
  "/moderation/review": { section: "Moderation", page: "Video Review" },
  "/moderation/actions": { section: "Moderation", page: "Audit Log" },
  "/moderation/terms": { section: "Moderation", page: "Terms" },
  "/users": { section: "Management", page: "Users" },
  "/videos": { section: "Management", page: "Videos" },
  "/comments": { section: "Management", page: "Comments" },
  "/system/queues": { section: "System", page: "Queues & DLQ" },
  "/settings": { section: "System", page: "Settings" },
  "/trash": { section: "System", page: "Trash" },
};

/**
 * The breadcrumb for a path, falling back to the nearest named page above it.
 *
 * A detail route — /users/123, /videos/abc, /users/123/activity — has no entry of its own and
 * never will: the id is a row, not a page worth naming here. Without the fallback it hits the
 * default and the breadcrumb reads "Dashboard / Overview" while the screen is showing an account.
 */
export function resolveCrumb(pathname: string): { section: string; page: string } {
  for (const path of ancestors(pathname)) {
    const crumb = ROUTE_TITLES[path];
    if (crumb) return crumb;
  }
  return { section: "Dashboard", page: "Overview" };
}
