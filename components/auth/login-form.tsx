"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { isTurnstileConfigured } from "@/lib/auth/turnstile";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";

type Step = "credentials" | "otp";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const turnstile = useTurnstileToken();

  const [step, setStep] = useState<Step>("credentials");
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    params.get("reset") ? "Password updated. Sign in with your new password." : null,
  );
  const [pending, setPending] = useState(false);

  const turnstileConfigured = isTurnstileConfigured();

  function land() {
    router.replace(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  async function post(payload: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, turnstileToken: turnstile.token }),
      });
      const body = (await response.json()) as { message?: string; mfaRequired?: boolean };
      return { ok: response.ok, body };
    } finally {
      // The token is single-use; every attempt gets a fresh widget.
      turnstile.consume();
      setPending(false);
    }
  }

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    const { ok, body } = await post({ usernameOrEmail, password });
    if (body.mfaRequired) {
      setStep("otp");
      setNotice("We emailed you a 6-digit code. It expires in 5 minutes.");
      return;
    }
    if (ok) {
      land();
      return;
    }
    setError(body.message ?? "Sign in failed.");
  }

  async function submitOtp(event: React.FormEvent) {
    event.preventDefault();
    const { ok, body } = await post({ usernameOrEmail, otp, rememberDevice });
    if (ok) {
      land();
      return;
    }
    setError(body.message ?? "That code didn't work.");
  }

  async function resend() {
    setOtp("");
    const { body } = await post({ usernameOrEmail, password });
    setNotice(
      body.mfaRequired
        ? "A new code is on its way — the previous one stops working."
        : "Couldn't send a new code. Go back and sign in again.",
    );
  }

  const submitDisabled = pending || !turnstile.token;

  return (
    <form onSubmit={step === "credentials" ? submitCredentials : submitOtp} className="space-y-3">
      {step === "credentials" ? (
        <>
          <label className="block">
            <span className="label-caps text-ink-soft">Username or email</span>
            <input
              name="usernameOrEmail"
              autoComplete="username"
              required
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] outline-none focus:border-ink-faint"
            />
          </label>

          <label className="block">
            <span className="label-caps text-ink-soft">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] outline-none focus:border-ink-faint"
            />
          </label>

          <Link
            href="/forgot-password"
            className="block text-right text-[11px] text-ink-faint underline"
          >
            Forgot password?
          </Link>
        </>
      ) : (
        <>
          <label className="block">
            <span className="label-caps text-ink-soft">6-digit code</span>
            <input
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-center text-[18px] tracking-[0.4em] outline-none focus:border-ink-faint"
            />
          </label>

          <label className="flex items-center gap-2 text-[12px] text-ink-soft">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Trust this device for 30 days
          </label>

          <button
            type="button"
            onClick={resend}
            disabled={submitDisabled}
            className="text-[11px] text-ink-soft underline disabled:opacity-40"
          >
            Send a new code
          </button>
        </>
      )}

      {turnstileConfigured ? (
        <div className="flex justify-center">
          <TurnstileWidget key={turnstile.widgetKey} onVerify={turnstile.setToken} />
        </div>
      ) : (
        <p className="rounded-lg border border-pending/25 bg-pending-bg px-3 py-2.5 text-[11px] text-pending">
          Set <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> in <code>.env.local</code> — admin login
          requires the Turnstile check.
        </p>
      )}

      {notice ? (
        <p className="rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[11px] text-ink-soft">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-bg px-3 py-2.5 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitDisabled}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        {step === "credentials" ? "Sign in" : "Verify & sign in"}
      </button>

      {step === "otp" ? (
        <button
          type="button"
          onClick={() => {
            setStep("credentials");
            setError(null);
            setNotice(null);
          }}
          className="w-full text-center text-[11px] text-ink-faint underline"
        >
          Back
        </button>
      ) : null}
    </form>
  );
}
