import { NextResponse } from "next/server";
import { GATEWAY_URL, TRUST_PROXY } from "@/lib/api/config";
import { forwardedHeaders } from "@/lib/api/forwarded";
import { parseWithLongIdsAsStrings } from "@/lib/api/json";
import type { ApiResponse } from "@/lib/api/types";
import {
  clearSessionCookies,
  getDeviceToken,
  getRefreshToken,
  setDeviceToken,
  setSessionCookies,
  setSessionProfile,
  toSession,
  type AuthUserResponse,
  type TokenResponse,
} from "@/lib/api/session";

/**
 * One call to the gateway, carrying the browser's identity with it.
 *
 * `from` is the request this handler is serving, and its user agent (and, behind a trusted proxy,
 * its forwarded-for chain) is relayed so auth-service's security log names the person signing in.
 * Without it every sign-in
 * was recorded as the device "node" — undici's own user agent — at this server's address.
 */
async function call<T>(path: string, init: RequestInit, from: Request): Promise<ApiResponse<T>> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...forwardedHeaders(from, TRUST_PROXY),
    },
    cache: "no-store",
  });
  const text = await response.text();
  return text
    ? parseWithLongIdsAsStrings<ApiResponse<T>>(text)
    : ({ success: response.ok, data: null as T, timestamp: "" } as ApiResponse<T>);
}

/**
 * A fresh response per call: a body can be read once, so one shared constant went out empty from
 * the second failure on.
 */
function gatewayDown() {
  return NextResponse.json(
    {
      code: "GATEWAY_UNREACHABLE",
      message: `Cannot reach the gateway at ${GATEWAY_URL}. Start it with 'make run-gateway'.`,
    },
    { status: 502 },
  );
}

/**
 * Ends a session at auth-service: the refresh token is revoked and, when given, the access token
 * blacklisted. Best effort — whatever auth-service says, the caller goes on to drop its side.
 */
async function endSession(
  tokens: { refreshToken: string; accessToken?: string },
  from: Request,
) {
  try {
    await call("/api/v1/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tokens.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    }, from);
  } catch {
    // Nothing to do about it here; the session is not kept on this side either way.
  }
}

/**
 * Turns a fresh token pair into console cookies, after checking the account is actually an ADMIN
 * — a valid non-admin token would sail past the gateway and then 403 on every panel, which reads
 * as a broken app rather than a refusal. Shared by the remembered-device path and the OTP path.
 *
 * A refused pair is ended, not just left uncollected: auth-service issued it, and until its
 * refresh token expires it is a live session for an account that only typed its password here.
 */
async function establishSession(tokens: TokenResponse, from: Request) {
  const me = await call<AuthUserResponse>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  }, from);

  if (!me.success || !me.data || me.data.role !== "ADMIN") {
    await endSession(tokens, from);
    return NextResponse.json(
      { code: "NOT_ADMIN", message: "This account does not have admin access." },
      { status: 403 },
    );
  }

  await setSessionCookies(tokens);
  await setSessionProfile(toSession(me.data));
  if (tokens.deviceToken) {
    await setDeviceToken(tokens.deviceToken);
  }

  return NextResponse.json({ username: me.data.username, role: me.data.role });
}

/**
 * Sign in. Two shapes:
 *   - `{ usernameOrEmail, password, turnstileToken }` — step one. Answers `{ mfaRequired: true }`
 *     when auth-service wants the emailed code, or sets the session outright if this browser is a
 *     remembered device.
 *   - `{ usernameOrEmail, otp, turnstileToken, rememberDevice }` — step two, exchanging the code
 *     for a session.
 * Credentials are posted from the browser to this handler and never leave the server after that.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    usernameOrEmail?: string;
    password?: string;
    otp?: string;
    turnstileToken?: string;
    rememberDevice?: boolean;
  };

  const usernameOrEmail = body.usernameOrEmail?.trim();
  if (!usernameOrEmail || !body.turnstileToken) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Missing sign-in details." },
      { status: 400 },
    );
  }

  // ---- Step two: the emailed code ----
  if (body.otp) {
    let otpLogin: ApiResponse<TokenResponse>;
    try {
      otpLogin = await call<TokenResponse>("/api/v1/auth/login/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernameOrEmail,
          otp: body.otp,
          turnstileToken: body.turnstileToken,
          rememberDevice: Boolean(body.rememberDevice),
        }),
      }, request);
    } catch {
      return gatewayDown();
    }

    if (!otpLogin.success || !otpLogin.data) {
      return NextResponse.json(
        { code: otpLogin.code ?? "INVALID_OTP", message: otpLogin.message ?? "That code didn't work." },
        { status: 401 },
      );
    }
    return establishSession(otpLogin.data, request);
  }

  // ---- Step one: password + Turnstile (+ a remembered-device token, if this browser has one) ----
  if (!body.password) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Password is required." },
      { status: 400 },
    );
  }

  let login: ApiResponse<TokenResponse>;
  try {
    login = await call<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrEmail,
        password: body.password,
        turnstileToken: body.turnstileToken,
        deviceToken: await getDeviceToken(),
      }),
    }, request);
  } catch {
    return gatewayDown();
  }

  if (login.code === "MFA_REQUIRED") {
    // A code is on its way; the form switches to its OTP step. No cookies yet.
    return NextResponse.json({ mfaRequired: true });
  }

  if (!login.success || !login.data) {
    // auth-service distinguishes EMAIL_NOT_VERIFIED / INVALID_CREDENTIALS on purpose — pass through.
    return NextResponse.json(
      { code: login.code ?? "INVALID_CREDENTIALS", message: login.message ?? "Login failed." },
      { status: 401 },
    );
  }

  // Reached only when the device was remembered and auth-service skipped the OTP step.
  return establishSession(login.data, request);
}

/** Sign out — revokes the refresh token server-side, then drops the session cookies. */
export async function DELETE(request: Request) {
  const refreshToken = await getRefreshToken();

  // Best effort: the cookies still go, so this browser is signed out either way.
  if (refreshToken) await endSession({ refreshToken }, request);

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
