// Run: node lib/api/forwarded.check.mjs
//
// This fails silently in the direction that matters: forget a header and the security log still
// fills up, with every sign-in attributed to this server instead of the person. So the cases are
// "the browser's identity survives the hop" and "nothing of this origin leaks into it".
import assert from "node:assert/strict";
import { forwardedHeaders } from "./forwarded.ts";

const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

const withHeaders = (headers) => new Request("http://localhost/api/session", { headers });

// Both halves of "who signed in, from where" are carried.
assert.deepEqual(
  forwardedHeaders(withHeaders({ "user-agent": CHROME, "x-forwarded-for": "203.0.113.7, 10.0.0.4" })),
  { "User-Agent": CHROME, "X-Forwarded-For": "203.0.113.7, 10.0.0.4" },
);

// The chain is relayed whole. Trimming it to the first entry would strip the hops the gateway
// walks to decide which entry it is allowed to believe.
assert.equal(
  forwardedHeaders(withHeaders({ "x-forwarded-for": "1.2.3.4, 203.0.113.7, 10.0.0.4" }))["X-Forwarded-For"],
  "1.2.3.4, 203.0.113.7, 10.0.0.4",
);

// The hints are the only thing that names a device, so losing them here loses the feature. They
// are relayed under the spelling the specification uses, not the lower-cased incoming one.
assert.deepEqual(
  forwardedHeaders(withHeaders({
    "sec-ch-ua-model": '"SM-A525F"',
    "sec-ch-ua-platform-version": '"15.0.0"',
  })),
  { "Sec-CH-UA-Model": '"SM-A525F"', "Sec-CH-UA-Platform-Version": '"15.0.0"' },
);

// Quotes are left on: they are part of the structured-header syntax, and auth-service strips
// them. Deciding what an empty hint means in two places is how the two answers drift apart.
assert.equal(
  forwardedHeaders(withHeaders({ "sec-ch-ua-model": '""' }))["Sec-CH-UA-Model"],
  '""',
);

// Safari and Firefox send no hints at all, which must not become empty headers.
assert.deepEqual(forwardedHeaders(withHeaders({ "user-agent": CHROME })), { "User-Agent": CHROME });

// Local development: no proxy, so no header. An empty string must not be relayed as a header the
// gateway would then try to parse as an address.
assert.deepEqual(forwardedHeaders(withHeaders({})), {});

// Nothing belonging to this origin goes downstream. The bearer token the console holds is not the
// caller's, and a Cookie header would carry the admin session to a service that has no use for it.
assert.deepEqual(
  forwardedHeaders(withHeaders({
    authorization: "Bearer console-session-token",
    cookie: "admin_session=console-session-token",
    host: "localhost:3001",
  })),
  {},
);

console.log("forwarded header checks passed");
