"use client";

import { useCallback, useState } from "react";

/**
 * A Cloudflare Turnstile token for a form that always requires one. A solved token is single-use
 * and expires ~5 minutes after solving, so it is thrown away after every submit — success or
 * failure — and a fresh widget mounted for the next one. `widgetKey` is that fresh mount: bump it
 * and hand it to `<TurnstileWidget key={widgetKey} .../>`.
 *
 * Ported verbatim from tiktok-cloned `src/lib/auth/use-turnstile-token.ts`.
 */
export function useTurnstileToken() {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  const consume = useCallback(() => {
    setToken(null);
    setWidgetKey((key) => key + 1);
  }, []);

  return { token, setToken, consume, widgetKey };
}
