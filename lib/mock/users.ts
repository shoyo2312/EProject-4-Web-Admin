import type { AdminUserResponse, UserStatus } from "@/lib/api/types";
import { MOCK_NOW, between, pick, seededRandom } from "./random";

const HANDLES = [
  "ryan_korsgaard", "madelyn.lubin", "abram_bergson", "phillip.mango",
  "tara_nguyen", "kenji.watanabe", "lucia_moreno", "omar_haddad",
  "sofia.ricci", "dev_null", "minh.hoang", "grace_tan",
  "arthur.pyne", "nadia_k", "sam.oduya", "wei.zhang",
  "petra_novak", "jonas.berg", "amara.obi", "luca_ferrari",
] as const;

const STATUSES: UserStatus[] = ["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "BANNED", "LOCKED"];

const DAY_MS = 24 * 60 * 60_000;

/**
 * 60 accounts, seeded so server render and client hydration agree. Two deliberate shapes the
 * real data has and a naive fixture would not: an account with no email at all (social login,
 * no address from the provider) and an unverified one.
 */
export const mockUsers: AdminUserResponse[] = (() => {
  const rand = seededRandom(20260905);
  return Array.from({ length: 60 }, (_, i) => {
    const handle = `${pick(rand, HANDLES)}${i > HANDLES.length ? i : ""}`;
    const social = i % 11 === 0;
    return {
      id: String(7_300_000_000_000_000_000n + BigInt(i * 4096)),
      username: handle,
      email: social ? null : `${handle.replace(/[._]/g, "")}@example.com`,
      role: i === 0 ? ("ADMIN" as const) : ("USER" as const),
      status: i === 0 ? ("ACTIVE" as const) : pick(rand, STATUSES),
      emailVerified: !social && i % 7 !== 3,
      emailVerifiedAt:
        !social && i % 7 !== 3
          ? new Date(MOCK_NOW - between(rand, 1, 380) * DAY_MS).toISOString()
          : null,
      createdAt: new Date(MOCK_NOW - between(rand, 1, 400) * DAY_MS).toISOString(),
      updatedAt: new Date(MOCK_NOW - between(rand, 0, 30) * DAY_MS).toISOString(),
      lastLoginAt:
        i % 5 === 0
          ? null
          : new Date(MOCK_NOW - between(rand, 0, 60) * DAY_MS).toISOString(),
      bannedAt: null,
      banReason: null,
      provider: social ? ("GOOGLE" as const) : null,
      linkedProviders: social ? ["GOOGLE" as const] : [],
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
})();
