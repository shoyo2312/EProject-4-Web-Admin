import { NextResponse } from "next/server";
import { GATEWAY_URL, GATEWAY_UNREACHABLE, TRUST_PROXY } from "@/lib/api/config";
import { forwardedHeaders } from "@/lib/api/forwarded";
import { parseWithLongIdsAsStrings } from "@/lib/api/json";
import { resetCodeAnswer, type ResetCodeResult } from "@/lib/api/password-reset";
import type { ApiResponse } from "@/lib/api/types";

/**
 * `from` is the request being served, relayed so the reset lands in auth-service's security log
 * as the browser that asked for it rather than as this server. See `forwardedHeaders`.
 */
async function call<T>(path: string, payload: unknown, from: Request): Promise<ApiResponse<T>> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...forwardedHeaders(from, TRUST_PROXY) },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await response.text();
  return text
    ? parseWithLongIdsAsStrings<ApiResponse<T>>(text)
    : ({ success: response.ok, data: null, timestamp: "" } as ApiResponse<T>);
}

/**
 * A fresh response per call: a body can be read once, so one shared constant went out empty from
 * the second failure on.
 */
function gatewayDown() {
  return NextResponse.json(
    {
      code: "GATEWAY_UNREACHABLE",
      message: GATEWAY_UNREACHABLE,
    },
    { status: 502 },
  );
}

/**
 * Password reset, mirrored on auth-service's two endpoints — the new password is posted from the
 * browser to this handler and never leaves the server after that, same as the login flow.
 *
 *   - `{ email, turnstileToken }` — step one. Always answers `{ sent: true, resendTicket }`:
 *     auth-service does not say whether the address exists, and neither does this.
 *   - `{ email, resendTicket }` — "Send a new code", on the ticket step one answered. A refused
 *     ticket is passed on rather than answered `sent`; see `resetCodeAnswer`.
 *   - `{ email, otp, newPassword }` — step two, spending the emailed code. No Turnstile — the OTP
 *     guess limiter is what protects this call.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    otp?: string;
    newPassword?: string;
    turnstileToken?: string;
    resendTicket?: string;
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
      reset = await call<null>("/api/v1/auth/reset-password", {
        email,
        otp: body.otp,
        newPassword: body.newPassword,
      }, request);
    } catch {
      return gatewayDown();
    }

    if (!reset.success) {
      return NextResponse.json(
        { code: reset.code ?? "INVALID_OTP", message: reset.message ?? "That code didn't work." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ---- Step one, or a new code: request one ----
  if (!body.turnstileToken && !body.resendTicket) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "Complete the verification check." },
      { status: 400 },
    );
  }

  let sent: ResetCodeResult;
  try {
    sent = await call("/api/v1/auth/forgot-password", {
      email,
      turnstileToken: body.turnstileToken,
      resendTicket: body.resendTicket,
    }, request);
  } catch {
    return gatewayDown();
  }

  const answer = resetCodeAnswer(sent, Boolean(body.resendTicket));
  return NextResponse.json(answer.body, { status: answer.status });
}
