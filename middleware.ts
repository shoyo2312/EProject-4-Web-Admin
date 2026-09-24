import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "admin_session";
const REFRESH_COOKIE = "admin_refresh";

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080";

/**
 * In mock mode there is no session to check and no backend to sign in against, so the
 * gate is skipped entirely — otherwise `npm run dev` would dead-end on a login form
 * that cannot succeed.
 */
const USE_MOCK = process.env.ADMIN_USE_MOCK !== "false";

type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresInMillis: number;
};

/**
 * The access-token cookie lives exactly as long as the token itself — 15 minutes,
 * auth-service's access-token expiry. Once it lapses the browser drops it and the
 * gate below would bounce a working session to /login even though the 7-day
 * refresh cookie beside it is still good. That was the "logs out after a while":
 * nothing ever spent the refresh token. So when the access cookie is gone but the
 * refresh cookie is present, rotate it here, before the request is served.
 *
 * auth-service rotates the refresh token single-use with replay detection (10s
 * grace), so exactly one of several concurrent requests wins the rotation and the
 * rest are rejected. That is routine here, not an attack: the access cookie's
 * maxAge is the token's own lifetime, so it lapses from every in-flight request at
 * the same instant, and the sidebar's <Link> prefetches plus AutoRefresh's poll
 * mean several are usually in flight. The losers must therefore be treated as
 * "try again", never as a dead session — see the redirect below.
 *
 * ponytail: no cross-request single-flight, which this layer cannot hold. The cost
 * is a few wasted rotate() calls every 15 minutes and, when the loser is the
 * navigation itself, one redirect to /login that immediately rotates and bounces
 * back to /dashboard. Add a shared lock only if that flash becomes a complaint.
 */
async function rotate(refreshToken: string): Promise<Tokens | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { success?: boolean; data?: Tokens | null };
    return body.success && body.data?.accessToken ? body.data : null;
  } catch {
    // Gateway unreachable — treat as not signed in, same as an expired session.
    return null;
  }
}

function applySession(response: NextResponse, tokens: Tokens) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.floor(tokens.expiresInMillis / 1000),
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function middleware(request: NextRequest) {
  if (USE_MOCK) return NextResponse.next();

  const onLoginPage = request.nextUrl.pathname === "/login";
  // Auth pages a signed-out admin must reach. /forgot-password belongs here, not as a redirect
  // target — the point of it is being usable without a session.
  const onPublicPage = onLoginPage || request.nextUrl.pathname === "/forgot-password";

  // A page hit a 401 from the gateway mid-session — token revoked server-side
  // (ban, replay, password reset) while the cookie was still within its maxAge,
  // so neither the gate nor the refresh path above would notice. `ErrorState`
  // redirects such a render here; drop both cookies and show the login form
  // rather than bouncing straight back to /dashboard on a dead token.
  if (onLoginPage && request.nextUrl.searchParams.has("expired")) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  let signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  let refreshed: Tokens | null = null;
  if (!signedIn && refreshToken) {
    refreshed = await rotate(refreshToken);
    if (refreshed) {
      signedIn = true;
      // Also on the forwarded request, so the server components rendering *this*
      // pass read the new token instead of throwing "not signed in" once.
      request.cookies.set(SESSION_COOKIE, refreshed.accessToken);
      request.cookies.set(REFRESH_COOKIE, refreshed.refreshToken);
    }
  }

  const forward = { request: { headers: request.headers } };

  if (!signedIn && !onPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to whatever was being opened once signed in
    url.searchParams.set("next", request.nextUrl.pathname);
    // Deliberately no cookie delete on a failed rotation. A failure here is far
    // more often a lost race or an unreachable gateway than a dead chain, and
    // deleting destroyed the 7-day refresh token that the *winning* request had
    // just rotated — the automatic logout every ~15 minutes. Leaving the cookie
    // costs one wasted rotate() on the next request and self-heals, because
    // /login is public and its own pass through here rotates and bounces to
    // /dashboard. A genuinely revoked token is torn down by the ?expired=1 branch
    // above, which is the one place that knows the gateway rejected the session.
    return NextResponse.redirect(url);
  }

  if (signedIn && onLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const res = NextResponse.redirect(url);
    if (refreshed) applySession(res, refreshed);
    return res;
  }

  const res = NextResponse.next(forward);
  if (refreshed) applySession(res, refreshed);
  return res;
}

export const config = {
  // Everything except the session handler, Next internals and static files.
  matcher: ["/((?!api/session|api/password-reset|_next/static|_next/image|favicon.ico).*)"],
};
