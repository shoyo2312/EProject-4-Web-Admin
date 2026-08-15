/**
 * Everything goes through api-gateway on :8080 — never straight to a service port.
 * The gateway is what rate-limits, checks the token is a live access token, and
 * routes /api/v1/admin/** and /api/v1/analytics/** to 8096 / 8097.
 */
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

/**
 * Mock is the default so `npm run dev` works with nothing else running — the live
 * path needs Postgres, ClickHouse, Kafka, Redis and four services up. Set
 * ADMIN_USE_MOCK=false in .env.local to hit the real gateway.
 */
export const USE_MOCK = process.env.ADMIN_USE_MOCK !== "false";

export const SESSION_COOKIE = "admin_session";
export const REFRESH_COOKIE = "admin_refresh";

/**
 * Sidebar collapsed state. A cookie rather than localStorage on purpose: the layout is a
 * server component, so it can read this and render the right width on the first paint.
 * localStorage is only readable after hydration, which means a visible snap from 260px
 * to 68px on every reload. Not httpOnly — the toggle is a client component and writes it.
 */
export const SIDEBAR_COOKIE = "admin_sidebar";
