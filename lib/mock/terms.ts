import type { ModerationTermResponse, ModerationTermSummaryResponse } from "@/lib/api/types";
import { MOCK_NOW } from "./random";

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** The mock directory's admin account, so "Added by" names someone. */
const ADMIN = "7300000000000000000";

function term(
  i: number,
  ago: number,
  fields: Pick<ModerationTermResponse, "term" | "action" | "category" | "note">,
): ModerationTermResponse {
  return {
    id: String(7_385_000_000_000_000_000n + BigInt(i)),
    createdBy: ADMIN,
    createdAt: new Date(MOCK_NOW - ago).toISOString(),
    ...fields,
  };
}

/**
 * The live admin terms, newest first as admin-service lists them. The shapes the list has to show:
 * a term the shipped list lacks, one made stricter than its shipped entry, a shipped one exempted
 * for a false positive, and one with no note at all.
 */
export const mockModerationTerms: ModerationTermResponse[] = [
  term(5, 2 * HOUR_MS, {
    term: "nhà cái uy tín",
    action: "REJECT",
    category: "SCAM",
    note: "Betting spam wave in the football comments — every one links an fb88 mirror.",
  }),
  term(4, DAY_MS, {
    term: "tăng follow",
    action: "HOLD",
    category: "SPAM",
    note: "Follower-selling replies under trending videos.",
  }),
  term(3, 3 * DAY_MS, {
    term: "sex",
    action: "EXEMPT",
    category: null,
    note: "Held the captions of sex-education videos. Until the shipped list is fixed.",
  }),
  term(2, 6 * DAY_MS, {
    term: "clip sex",
    action: "REJECT",
    category: "SEXUAL",
    note: "Stricter than the shipped hold: only ever used to sell links.",
  }),
  term(1, 12 * DAY_MS, { term: "kèo thơm", action: "HOLD", category: "SCAM", note: null }),
];

/** Revision past the count: removals move it too, and two terms were added and taken out again. */
export const mockModerationTermSummary: ModerationTermSummaryResponse = {
  shippedVersion: "2026.10.15",
  shippedTerms: 95,
  revision: 9,
  adminTerms: mockModerationTerms.length,
  version: "rules-2026.10.15+admin-9",
};
