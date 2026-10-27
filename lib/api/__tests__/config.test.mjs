// Run: node lib/api/__tests__/config.test.mjs
import assert from "node:assert/strict";
import { sessionCookies } from "../config.ts";

// One definition for the sign-in handler and the proxy: the access cookie dies with the token,
// the refresh cookie lasts the week the refresh token does, and neither is readable from script.
const [access, refresh] = sessionCookies({
  accessToken: "access",
  refreshToken: "refresh",
  expiresInMillis: 900_500,
});
assert.equal(access.name, "admin_session");
assert.equal(access.value, "access");
assert.equal(access.options.maxAge, 900, "whole seconds, never past the token's own expiry");
assert.equal(refresh.name, "admin_refresh");
assert.equal(refresh.options.maxAge, 7 * 24 * 60 * 60);
for (const { options } of [access, refresh]) {
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
}

console.log("config checks passed");

// Development mocks unless told not to; production goes live unless told to mock — a container
// started with no env must never serve fake data with no login.
import { mockByDefault, missingDeployConfig } from "../config.ts";
assert.equal(mockByDefault({}), true);
assert.equal(mockByDefault({ ADMIN_USE_MOCK: "false" }), false);
assert.equal(mockByDefault({ NODE_ENV: "production" }), false);
assert.equal(mockByDefault({ NODE_ENV: "production", ADMIN_USE_MOCK: "true" }), true);
assert.equal(missingDeployConfig({ NODE_ENV: "production" })?.startsWith("GATEWAY_URL is not set"), true);
assert.equal(missingDeployConfig({ NODE_ENV: "production", GATEWAY_URL: "http://api-gateway:8080" }), undefined);
assert.equal(missingDeployConfig({ NODE_ENV: "production", ADMIN_USE_MOCK: "true" }), undefined, "a mock preview needs no gateway");
assert.equal(missingDeployConfig({}), undefined, "dev never refuses to start");
