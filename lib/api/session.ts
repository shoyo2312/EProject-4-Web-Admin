import "server-only";

import { cookies } from "next/headers";
import { DEVICE_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, USE_MOCK } from "./config";
import { CURRENT_ADMIN } from "@/lib/mock/session";

export interface AdminSession {
  userId: string;
  username: string;
  role: string;
  initials: string;
}

/** auth-service TokenResponse */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMillis: number;
  /** Present only on the /login/otp response when "remember this device" was ticked. */
  deviceToken?: string | null;
}

/** auth-service UserResponse */
export interface AuthUserResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
}

function initialsOf(username: string) {
  return username
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function toSession(user: AuthUserResponse): AdminSession {
  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    initials: initialsOf(user.username),
  };
}

/**
 * The access token lives in an httpOnly cookie, so no client component can read it and
 * an XSS payload can't exfiltrate it. Every API call runs server-side.
 */
export async function setSessionCookies(tokens: TokenResponse) {
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";

  jar.set(SESSION_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: Math.floor(tokens.expiresInMillis / 1000),
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookies() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getRefreshToken() {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}

export async function getDeviceToken() {
  return (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
}

/**
 * Kept 30 days and NOT httpOnly-exempt: like the session cookies it must never be readable by a
 * client component. Deliberately not cleared on logout — its whole purpose is to let the next
 * sign-in from this browser skip the email OTP, and the password still gates that sign-in.
 */
export async function setDeviceToken(deviceToken: string) {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

const SESSION_PROFILE_COOKIE = "admin_profile";

export async function setSessionProfile(session: AdminSession) {
  const jar = await cookies();
  jar.set(SESSION_PROFILE_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

/** Falls back to the mock admin so the console still renders with no backend running. */
export async function getSessionProfile(): Promise<AdminSession> {
  if (USE_MOCK) {
    return {
      userId: CURRENT_ADMIN.id,
      username: CURRENT_ADMIN.name,
      role: CURRENT_ADMIN.role,
      initials: CURRENT_ADMIN.initials,
    };
  }

  const raw = (await cookies()).get(SESSION_PROFILE_COOKIE)?.value;
  if (!raw) {
    return { userId: "", username: "Unknown", role: "ADMIN", initials: "?" };
  }
  return JSON.parse(raw) as AdminSession;
}
