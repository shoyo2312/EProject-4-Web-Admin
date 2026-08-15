import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "admin_session";

/**
 * In mock mode there is no session to check and no backend to sign in against, so the
 * gate is skipped entirely — otherwise `npm run dev` would dead-end on a login form
 * that cannot succeed.
 */
const USE_MOCK = process.env.ADMIN_USE_MOCK !== "false";

export function middleware(request: NextRequest) {
  if (USE_MOCK) return NextResponse.next();

  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const onLoginPage = request.nextUrl.pathname === "/login";

  if (!signedIn && !onLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to whatever was being opened once signed in
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && onLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the session handler, Next internals and static files.
  matcher: ["/((?!api/session|_next/static|_next/image|favicon.ico).*)"],
};
