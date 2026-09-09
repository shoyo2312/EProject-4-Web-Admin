import { NextResponse } from "next/server";
import { GATEWAY_URL } from "@/lib/api/config";
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

async function call<T>(path: string, init: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    cache: "no-store",
  });
  const text = await response.text();
  return text
    ? parseWithLongIdsAsStrings<ApiResponse<T>>(text)
    : ({ success: response.ok, data: null as T, timestamp: "" } as ApiResponse<T>);
}

const GATEWAY_DOWN = NextResponse.json(
  {
    code: "GATEWAY_UNREACHABLE",
    message: `Cannot reach the gateway at ${GATEWAY_URL}. Start it with 'make run-gateway'.`,
  },
  { status: 502 },
);

/**
 * Turns a fresh token pair into console cookies, after checking the account is actually an ADMIN
 * — a valid non-admin token would sail past the gateway and then 403 on every panel, which reads
 * as a broken app rather than a refusal. Shared by the remembered-device path and the OTP path.
 */
async function establishSession(tokens: TokenResponse) {
  const me = await call<AuthUserResponse>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });

  if (!me.success || !me.data || me.data.role !== "ADMIN") {
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
      });
    } catch {
      return GATEWAY_DOWN;
    }

    if (!otpLogin.success || !otpLogin.data) {
      return NextResponse.json(
        { code: otpLogin.code ?? "INVALID_OTP", message: otpLogin.message ?? "That code didn't work." },
        { status: 401 },
      );
    }
    return establishSession(otpLogin.data);
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
    });
  } catch {
    return GATEWAY_DOWN;
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
  return establishSession(login.data);
}

/** Sign out — revokes the refresh token server-side, then drops the session cookies. */
export async function DELETE() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await call("/api/v1/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best effort: the cookies still go, so this browser is signed out either way.
    }
  }

  await clearSessionCookies();
  return NextResponse.json({ ok: true });
}
