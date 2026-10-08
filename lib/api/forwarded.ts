/**
 * The headers a route handler has to carry through to the gateway so that auth-service's security
 * log records the person who signed in, rather than this server.
 *
 * A route handler is not a proxy. `next.config.ts` rewrites are — they hand the original request
 * on with its headers intact — but a server-side `fetch` builds a brand-new request, and undici
 * sends its own `User-Agent: node`. That is why an admin sign-in landed in the log as the device
 * "node" with the Next server's own address: nothing of the browser survived the hop.
 *
 * Only these four are relayed. Everything else the browser sent is either irrelevant to the log
 * or actively wrong to pass on — `Authorization` and `Cookie` belong to this origin, and `Host`
 * and `Content-Length` describe a request that no longer exists.
 *
 * The two `Sec-CH-UA-*` hints are what actually names the device: the user agent no longer
 * carries the model or a truthful OS version. The browser sends them because `next.config.ts`
 * asks for them with `Accept-CH`; it is this relay that gets them the rest of the way, since a
 * server-side `fetch` copies nothing.
 *
 * Trust: `X-Forwarded-For` is relayed only when `trustProxy` is set, i.e. when a proxy in front of
 * this server *overwrites* the header. Without one the value is whatever the caller typed — Next
 * only fills it in when it is absent — and the gateway believes it, since it sees this server as
 * the client and this server is trusted. A caller could then pick a fresh address per request and
 * walk past the per-IP rate limiter, which is all that guards the OTP steps. Unset, the gateway
 * files every sign-in under this server's address: less useful in the log, but true. See
 * api-gateway's `RateLimiterConfig`, which documents the same condition for the rate limiter.
 */
/** Header names as the specification spells them, since the incoming ones are lower-cased. */
const CANONICAL = {
  "sec-ch-ua-model": "Sec-CH-UA-Model",
  "sec-ch-ua-platform-version": "Sec-CH-UA-Platform-Version",
} as const;

export function forwardedHeaders(request: Request, trustProxy: boolean): Record<string, string> {
  const relayed: Record<string, string> = {};

  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    relayed["User-Agent"] = userAgent;
  }

  const forwardedFor = trustProxy ? request.headers.get("x-forwarded-for") : null;
  if (forwardedFor) {
    relayed["X-Forwarded-For"] = forwardedFor;
  }

  // Absent for Safari and Firefox, which implement no client hints, and empty for the model on
  // every desktop Chromium. Relayed as received either way — auth-service decides what an empty
  // hint means, so that judgement lives in one place rather than at both ends of the hop.
  for (const hint of ["sec-ch-ua-model", "sec-ch-ua-platform-version"] as const) {
    const value = request.headers.get(hint);
    if (value) {
      relayed[CANONICAL[hint]] = value;
    }
  }

  return relayed;
}
