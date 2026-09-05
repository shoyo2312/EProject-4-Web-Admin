import {
  Boxes,
  FileClock,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Package,
  Radio,
  ReceiptText,
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
   * Phase 1 wires the screens that admin-service / analytics-service / inventory-service
   * already expose. The rest are shells until their backend endpoints exist.
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
      { label: "Users", href: "/users", icon: Users },
      { label: "Videos", href: "/videos", icon: Video },
      { label: "Comments", href: "/comments", icon: MessageSquare },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "Orders", href: "/orders", icon: ReceiptText },
      { label: "Inventory", href: "/inventory", icon: Boxes, ready: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Queues & DLQ", href: "/system/queues", icon: Radio },
      { label: "Settings", href: "/settings", icon: Settings },
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
  "/products": { section: "Commerce", page: "Products" },
  "/orders": { section: "Commerce", page: "Orders" },
  "/inventory": { section: "Commerce", page: "Inventory" },
  "/system/queues": { section: "System", page: "Queues & DLQ" },
  "/settings": { section: "System", page: "Settings" },
};
