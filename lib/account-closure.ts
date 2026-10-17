import type { AdminUserResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

/**
 * What the console says about an account its owner closed, or null for one they did not.
 *
 * The deletion still runs under a ban — the owner asked for it, and a banned account cannot sign
 * in to call it off — so a BANNED row says so: an account under investigation can be gone on
 * that date. A ban keeps the closure too, so lifting it does not reopen the account.
 */
export function closureNote(
  user: Pick<AdminUserResponse, "status" | "deactivatedAt" | "deletionScheduledAt">,
): string | null {
  if (!user.deactivatedAt) return null;
  const banned = user.status === "BANNED";
  const closed = `Closed by its owner on ${formatDateTime(user.deactivatedAt)}`;

  if (!user.deletionScheduledAt) {
    return banned
      ? `${closed}. Lifting the ban leaves it closed.`
      : `${closed}. It reopens if they sign in again.`;
  }

  const deletion = `deleted for good on ${formatDateTime(user.deletionScheduledAt)}`;
  return banned
    ? `${closed}; ${deletion}. The ban does not stop the deletion, and lifting it leaves the account closed.`
    : `${closed}; ${deletion} unless they sign in before then.`;
}
