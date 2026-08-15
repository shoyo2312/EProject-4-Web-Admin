/**
 * Stands in for the signed-in admin. Real source will be the JWT issued by
 * auth-service (subject + `role` claim, which must be ROLE_ADMIN to reach
 * anything under /api/v1/admin).
 */
export const CURRENT_ADMIN = {
  id: "7250000000000000007",
  name: "Minh Hung",
  handle: "minh.hoang",
  role: "Platform Moderator",
  initials: "MH",
} as const;
