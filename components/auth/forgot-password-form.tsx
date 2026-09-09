"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { isTurnstileConfigured } from "@/lib/auth/turnstile";
import { useTurnstileToken } from "@/lib/auth/use-turnstile-token";

type Step = "request" | "reset";

export function ForgotPasswordForm() {
  const router = useRouter();
  const turnstile = useTurnstileToken();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const turnstileConfigured = isTurnstileConfigured();

  async function post(payload: Record<string, unknown>, withTurnstile: boolean) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withTurnstile ? { ...payload, turnstileToken: turnstile.token } : payload,
        ),
      });
      const body = (await response.json()) as { message?: string };
      return { ok: response.ok, body };
    } finally {
      if (withTurnstile) turnstile.consume();
      setPending(false);
    }
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    const { ok, body } = await post({ email }, true);
    if (ok) {
      setStep("reset");
      setNotice("If that email has an admin account, a 6-digit code is on its way. It expires shortly.");
      return;
    }
    setError(body.message ?? "Couldn't send a reset code.");
  }

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    const { ok, body } = await post({ email, otp, newPassword }, false);
    if (ok) {
      router.replace("/login?reset=1");
      return;
    }
    setError(body.message ?? "That code didn't work.");
  }

  return (
    <form onSubmit={step === "request" ? submitRequest : submitReset} className="space-y-3">
      <label className="block">
        <span className="label-caps text-ink-soft">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          readOnly={step === "reset"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] outline-none focus:border-ink-faint read-only:opacity-60"
        />
      </label>

      {step === "reset" ? (
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

          <label className="block">
            <span className="label-caps text-ink-soft">New password</span>
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] outline-none focus:border-ink-faint"
            />
          </label>
        </>
      ) : turnstileConfigured ? (
        <div className="flex justify-center">
          <TurnstileWidget key={turnstile.widgetKey} onVerify={turnstile.setToken} />
        </div>
      ) : (
        <p className="rounded-lg border border-pending/25 bg-pending-bg px-3 py-2.5 text-[11px] text-pending">
          Set <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> in <code>.env.local</code> — the reset
          request needs the Turnstile check.
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
        disabled={pending || (step === "request" && !turnstile.token)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        {step === "request" ? "Send reset code" : "Set new password"}
      </button>

      {step === "reset" ? (
        <button
          type="button"
          onClick={() => {
            setStep("request");
            setError(null);
            setNotice(null);
            setOtp("");
            setNewPassword("");
          }}
          className="w-full text-center text-[11px] text-ink-faint underline"
        >
          Back
        </button>
      ) : (
        <Link
          href="/login"
          className="block w-full text-center text-[11px] text-ink-faint underline"
        >
          Back to sign in
        </Link>
      )}
    </form>
  );
}
