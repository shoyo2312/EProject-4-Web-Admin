import { NextResponse } from "next/server";
import { GATEWAY_URL } from "@/lib/api/config";
import { parseWithLongIdsAsStrings } from "@/lib/api/json";
import type { ApiResponse } from "@/lib/api/types";
import {
  clearSessionCookies,
  getRefreshToken,
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

/** Sign in. Credentials are posted from the browser to this handler and never leave the server after that. */
export async function POST(request: Request) {
  const { usernameOrEmail, password } = (await request.json()) as {
    usernameOrEmail?: string;
    password?: string;
  };

  if (!usernameOrEmail || !password) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Username and password are required." },
      { status: 400 },
    );
  }

  let login: ApiResponse<TokenResponse>;
  try {
    login = await call<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernameOrEmail, password }),
    });
  } catch {
    return NextResponse.json(
      {
        code: "GATEWAY_UNREACHABLE",
        message: `Cannot reach the gateway at ${GATEWAY_URL}. Start it with 'make run-gateway'.`,
      },
      { status: 502 },
    );
  }

  if (!login.success || !login.data) {
    // auth-service distinguishes EMAIL_NOT_VERIFIED from INVALID_CREDENTIALS on purpose — pass it through.
    return NextResponse.json(
      { code: login.code ?? "INVALID_CREDENTIALS", message: login.message ?? "Login failed." },
      { status: 401 },
    );
  }

  const me = await call<AuthUserResponse>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  });

  // The console is admin-only. A valid non-admin token would sail past the gateway and
  // then 403 on every single panel, which reads as a broken app rather than a refusal.
  if (!me.success || !me.data || me.data.role !== "ADMIN") {
    return NextResponse.json(
      { code: "NOT_ADMIN", message: "This account does not have admin access." },
      { status: 403 },
    );
  }

  await setSessionCookies(login.data);
  await setSessionProfile(toSession(me.data));

  return NextResponse.json({ username: me.data.username, role: me.data.role });
}

/** Sign out — revokes the refresh token server-side, then drops the cookies. */
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
