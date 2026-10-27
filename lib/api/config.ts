/**
 * Everything goes through api-gateway on :8080 — never straight to a service port.
 * The gateway is what rate-limits, checks the token is a live access token, and
 * routes /api/v1/admin/** and /api/v1/analytics/** to 8096 / 8097.
 */
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

export const PRODUCTION = process.env.NODE_ENV === "production";

type DeployEnv = { NODE_ENV?: string; ADMIN_USE_MOCK?: string; GATEWAY_URL?: string };

/**
 * In development mock is the default so `npm run dev` works with nothing else running — the live
 * path needs Postgres, ClickHouse, Kafka, Redis and four services up; set ADMIN_USE_MOCK=false in
 * .env.local to hit the real gateway. In production the default flips: a container started with
 * no env at all must not serve fake data with no login, so mock there (a `next start` preview)
 * takes an explicit ADMIN_USE_MOCK=true.
 */
export function mockByDefault(env: DeployEnv): boolean {
  return env.NODE_ENV === "production" ? env.ADMIN_USE_MOCK === "true" : env.ADMIN_USE_MOCK !== "false";
}

export const USE_MOCK = mockByDefault(process.env);

/**
 * What stops a live production server from starting — checked once in `instrumentation.ts`.
 * Without it the server starts fine and fails every request against localhost:8080.
 */
export function missingDeployConfig(env: DeployEnv): string | undefined {
  if (env.NODE_ENV !== "production" || mockByDefault(env)) return undefined;
  if (!env.GATEWAY_URL) {
    return "GATEWAY_URL is not set. Point it at api-gateway (http://api-gateway:8080 on the Coolify network), or set ADMIN_USE_MOCK=true for a mock-only preview.";
  }
  return undefined;
}

/** Shared by the sign-in and password-reset handlers. The `make` hint is for a laptop, not a server. */
export const GATEWAY_UNREACHABLE =
  `Cannot reach the gateway at ${GATEWAY_URL}.` + (PRODUCTION ? "" : " Start it with 'make run-gateway'.");

/**
 * Set only when this server sits behind a proxy that overwrites `X-Forwarded-For`. Off, the
 * browser's own value is not relayed to the gateway — see `forwardedHeaders`.
 */
export const TRUST_PROXY = process.env.ADMIN_TRUST_PROXY === "true";

export const SESSION_COOKIE = "admin_session";
export const REFRESH_COOKIE = "admin_refresh";

/** Who is signed in — name, role and initials for the sidebar — set beside the tokens at sign-in. */
export const PROFILE_COOKIE = "admin_profile";

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresInMillis: number;
}

/**
 * The two token cookies and how they are set: by the sign-in handler, and by the proxy when it
 * rotates an expired access token. One definition, so a session the proxy refreshed is the same
 * cookie a sign-in wrote.
 *
 * httpOnly, so no client component and no injected script can read a token. The access cookie
 * lives exactly as long as the token; the refresh cookie a week, as auth-service's refresh token.
 */
export function sessionCookies(tokens: SessionTokens) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  return [
    {
      name: SESSION_COOKIE,
      value: tokens.accessToken,
      options: { ...options, maxAge: Math.floor(tokens.expiresInMillis / 1000) },
    },
    { name: REFRESH_COOKIE, value: tokens.refreshToken, options: { ...options, maxAge: 7 * 24 * 60 * 60 } },
  ];
}

/**
 * A "remember this device" token from a past OTP-verified login. Sent back on the next login so
 * auth-service skips the email-OTP step; httpOnly, 30-day lifetime, survives logout (the password
 * still gates re-entry). Issued and validated entirely by auth-service — see its
 * `remembered_devices` table.
 */
export const DEVICE_COOKIE = "admin_device";

/**
 * Sidebar collapsed state. A cookie rather than localStorage on purpose: the layout is a
 * server component, so it can read this and render the right width on the first paint.
 * localStorage is only readable after hydration, which means a visible snap from 260px
 * to 68px on every reload. Not httpOnly — the toggle is a client component and writes it.
 */
export const SIDEBAR_COOKIE = "admin_sidebar";

/**
 * Newest notification timestamp (epoch ms) the admin had seen when they last opened the bell.
 * A cookie for the same reason as the sidebar's: the layout reads it, so the unread badge is
 * right on first paint instead of flashing in after hydration.
 */
export const NOTIFICATIONS_SEEN_COOKIE = "admin_notifications_seen";

/** "light" or "dark". Read by the root layout for the same first-paint reason as the sidebar's. */
export const THEME_COOKIE = "admin_theme";
