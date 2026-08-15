/**
 * Mirrors the real backend response records 1-1. When the mock layer is swapped for
 * fetch() against the gateway, nothing in the components has to change.
 *
 * Sources:
 *   admin-service      com.tiktok.adminservice.dto.response.*
 *   analytics-service  com.tiktok.analyticsservice.dto.response.*
 *
 * Note on ids: the backend uses Snowflake `Long` ids, which exceed Number.MAX_SAFE_INTEGER.
 * They are typed as `string` here — JSON.parse would silently corrupt them as numbers.
 */

/** admin-service — entity/ReportStatus.java */
export type ReportStatus = "PENDING" | "RESOLVED" | "DISMISSED";

/** admin-service — entity/ReportTargetType.java */
export type ReportTargetType = "USER" | "VIDEO" | "PRODUCT" | "COMMENT";

/** admin-service — entity/ModerationActionType.java */
export type ModerationActionType =
  | "BAN_USER"
  | "UNBAN_USER"
  | "TAKEDOWN_VIDEO"
  | "RESTORE_VIDEO"
  | "SUSPEND_PRODUCT"
  | "REACTIVATE_PRODUCT"
  | "WARN_USER"
  | "DISMISS_REPORT";

/** GET /api/v1/admin/reports — ReportResponse */
export interface ReportResponse {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** GET /api/v1/admin/actions — ModerationActionResponse */
export interface ModerationActionResponse {
  id: string;
  adminId: string;
  actionType: ModerationActionType;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  reportId: string | null;
  createdAt: string;
}

/** GET /api/v1/admin/stats/summary — StatsSummaryResponse */
export interface StatsSummaryResponse {
  pendingReports: number;
  resolvedReports: number;
  dismissedReports: number;
  actionsLast24h: number;
}

/** GET /api/v1/analytics/engagement/daily?days= — DailyCountResponse */
export interface DailyCountResponse {
  day: string;
  eventType: string;
  count: number;
}

/** GET /api/v1/analytics/revenue/daily?days= — DailyRevenueResponse */
export interface DailyRevenueResponse {
  day: string;
  ordersCreated: number;
  paymentsCompleted: number;
  /** BigDecimal on the wire — kept as string so money never touches a float */
  revenue: string;
}

/** GET /api/v1/analytics/signups/daily?days= — DailySignupResponse */
export interface DailySignupResponse {
  day: string;
  signups: number;
}

/** GET /api/v1/inventory/{productId} — inventory-service */
export interface InventoryResponse {
  productId: string;
  available: number;
  reserved: number;
  updatedAt: string;
}

/** common-lib ApiResponse<T> — every service wraps its payload in this */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  code?: string;
  message?: string;
  timestamp: string;
}

/** Spring Data Page<T>, as serialized by the admin-service list endpoints */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
