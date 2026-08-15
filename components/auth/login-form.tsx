"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernameOrEmail: form.get("usernameOrEmail"),
        password: form.get("password"),
      }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      setError(body.message ?? "Sign in failed.");
      setPending(false);
      return;
    }

    router.replace(params.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="label-caps text-ink-soft">Username or email</span>
        <input
          name="usernameOrEmail"
          autoComplete="username"
          required
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
          className="mt-1.5 w-full rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[13px] outline-none focus:border-ink-faint"
        />
      </label>

      {error ? (
        <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-bg px-3 py-2.5 text-[11px] text-danger">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ArrowRight className="h-3.5 w-3.5" />
        )}
        Sign in
      </button>
    </form>
  );
}
