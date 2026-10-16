import type { NextConfig } from "next";

/**
 * The client hints auth-service's security log needs, asked for on every response.
 *
 * A browser sends these only after it has seen `Accept-CH` from the origin it is talking to, and
 * the origin it talks to is this app — never the gateway, which it reaches only through a server
 * handler. So the request has to be made here or the log never gets either value.
 *
 *  - `Sec-CH-UA-Model` is the only way the web will name a device. The user agent stopped
 *    carrying it: Chrome freezes the Android model to the literal "K", and desktop agents never
 *    had it. Chromium answers this with "" on every desktop platform by specification, so in
 *    practice it names Android phones and nothing else. Apple hardware is not exposed by any
 *    means, on any browser.
 *  - `Sec-CH-UA-Platform-Version` is the real OS version. The agent's is frozen — every Mac
 *    claims to be an Intel machine on 10.15, whatever it is.
 *
 * Safari and Firefox implement no client hints, so the log keeps falling back to the agent for
 * them. That is the floor, not a bug. Only `Accept-CH` is sent and not `Critical-CH`: the sign-in
 * form is posted after the page has loaded, so the hints are already on that request, and
 * `Critical-CH` would buy a retried first navigation nothing here reads.
 */
const CLIENT_HINTS = "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Accept-CH", value: CLIENT_HINTS }],
      },
    ];
  },
};

export default nextConfig;
