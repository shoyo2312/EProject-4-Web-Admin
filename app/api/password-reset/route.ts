import { NextResponse } from "next/server";
import { GATEWAY_URL } from "@/lib/api/config";
import { parseWithLongIdsAsStrings } from "@/lib/api/json";
import type { ApiResponse } from "@/lib/api/types";

async function call(path: string, payload: unknown): Promise<ApiResponse<null>> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await response.text();
  return text
    ? parseWithLongIdsAsStrings<ApiResponse<null>>(text)
    : ({ success: response.ok, data: null, timestamp: "" } as ApiResponse<null>);
}

const GATEWAY_DOWN = NextResponse.json(
  {
    code: "GATEWAY_UNREACHABLE",
    message: `Cannot reach the gateway at ${GATEWAY_URL}. Start it with 'make run-gateway'.`,
  },
  { status: 502 },
);

/**
 * Password reset, mirrored on auth-service's two endpoints — the new password is posted from the
 * browser to this handler and never leaves the server after that, same as the login flow.
 *
 *   - `{ email, turnstileToken }` — step one. Always answers `{ sent: true }`: auth-service does
 *     not say whether the address exists, and neither does this.
 *   - `{ email, otp, newPassword }` — step two, spending the emailed code. No Turnstile — the OTP
 *     guess limiter is what protects this call.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    otp?: string;
    newPassword?: string;
    turnstileToken?: string;
  };

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Email is required." },
      { status: 400 },
    );
  }

  // ---- Step two: the emailed code ----
  if (body.otp || body.newPassword) {
    if (!body.otp || !body.newPassword) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "Both the code and a new password are required." },
        { status: 400 },
      );
    }

    let reset: ApiResponse<null>;
    try {
      reset = await call("/api/v1/auth/reset-password", {
        email,
        otp: body.otp,
        newPassword: body.newPassword,
      });
    } catch {
      return GATEWAY_DOWN;
    }

    if (!reset.success) {
      return NextResponse.json(
        { code: reset.code ?? "INVALID_OTP", message: reset.message ?? "That code didn't work." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ---- Step one: request a code ----
  if (!body.turnstileToken) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Complete the verification check." },
      { status: 400 },
    );
  }

  try {
    await call("/api/v1/auth/forgot-password", { email, turnstileToken: body.turnstileToken });
  } catch {
    return GATEWAY_DOWN;
  }

  // Deliberately not forwarding a failure here: a bad Turnstile token is the only real error, and
  // surfacing "no such account" would be an enumeration oracle.
  return NextResponse.json({ sent: true });
}
