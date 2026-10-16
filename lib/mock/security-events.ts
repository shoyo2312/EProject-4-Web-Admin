import type { SecurityEventResponse, SecurityEventType } from "@/lib/api/types";
import { mockUsers } from "./users";
import { MOCK_NOW, between, pick, seededRandom } from "./random";

const HOUR_MS = 60 * 60_000;

const AGENTS: [string, string][] = [
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    "Chrome on macOS",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
    "Edge on Windows",
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Safari on iOS",
  ],
  // The one shape that can carry a device model: Chromium on Android, naming it through the
  // Sec-CH-UA-Model hint. No desktop or Apple agent can, so the fixtures must not pretend.
  [
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
    "Chrome on Android 15 · SM-A525F",
  ],
];

/**
 * A few sign-ins and the occasional failure per account, so mock mode shows the shape of a real
 * security log rather than an empty tab.
 *
 * Seeded like the rest of the fixtures, because the page is server-rendered and then hydrated: an
 * unseeded random would produce two different lists and React would complain about both.
 *
 * Deliberately thinner than the live table — this exists to lay out the UI, not to stand in for
 * data. Only the kinds that shape the timeline are here.
 */
export const mockSecurityEvents: Record<string, SecurityEventResponse[]> = (() => {
  const rand = seededRandom(20260923);
  const byUser: Record<string, SecurityEventResponse[]> = {};

  for (const user of mockUsers) {
    const [userAgent, deviceLabel] = pick(rand, AGENTS);
    const events: SecurityEventResponse[] = [];

    const add = (eventType: SecurityEventType, hoursAgo: number, detail: string | null = null) => {
      events.push({
        id: `${user.id}-${events.length}`,
        eventType,
        ipAddress: `203.0.113.${between(rand, 2, 250)}`,
        userAgent,
        deviceLabel,
        detail,
        createdAt: new Date(MOCK_NOW - hoursAgo * HOUR_MS).toISOString(),
      });
    };

    for (let i = 0; i < between(rand, 2, 6); i++) {
      add("LOGIN_SUCCEEDED", between(rand, 1, 900));
    }
    // Not on every account: a failed attempt is a real signal in the timeline, and one on every
    // row would make it look like background noise.
    if (between(rand, 0, 2) === 0) {
      add("LOGIN_FAILED", between(rand, 1, 900));
    }
    if (user.emailVerifiedAt) {
      add("EMAIL_VERIFIED", between(rand, 900, 2000), user.email);
    }
    if (user.role === "ADMIN") {
      add("MFA_CHALLENGED", between(rand, 1, 100));
      add("DEVICE_REMEMBERED", between(rand, 1, 100),
        "admin second factor skipped on this browser for 30 days");
    }

    byUser[user.id] = events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  return byUser;
})();
