"use client";

import { useEffect, useRef } from "react";

import { removeTurnstile, renderTurnstile } from "@/lib/auth/turnstile";

/**
 * Solving it hands the token up via `onVerify`; the login form attaches that to its next request.
 * A widget that errors or expires stops calling `onVerify`, so the submit button re-disables
 * itself. Ported from tiktok-cloned `src/components/auth/TurnstileWidget.tsx`.
 */
export function TurnstileWidget({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let widgetId: string | undefined;
    let cancelled = false;

    renderTurnstile(
      container,
      { onToken: onVerify, onError: () => undefined },
      () => cancelled,
    ).then((id) => {
      widgetId = id;
    });

    return () => {
      cancelled = true;
      if (widgetId) removeTurnstile(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="mt-3" />;
}
