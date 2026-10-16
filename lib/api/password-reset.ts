import type { ApiResponse } from "./types";

/** auth-service's answer to `forgot-password`. `data` is null from a version that predates the ticket. */
export type ResetCodeResult = ApiResponse<{ resendTicket?: string | null } | null>;

/**
 * What the browser hears about a request for a reset code. `resendTicket` goes back with the next
 * "Send a new code" in place of a Turnstile token, for 15 minutes from the check that earned it.
 */
export type ResetCodeAnswer =
  | { sent: true; resendTicket: string | null }
  | { code: string; message: string };

/**
 * A code that went out answers `sent` with its resend ticket. A failure on a Turnstile token
 * answers `sent` all the same, with no ticket: the form says "if that email has an admin
 * account" either way, and asking for a reset must not read differently for an address that has
 * none.
 *
 * A failure on a ticket is passed on, because the form has to learn that the ticket was refused
 * to put the check back up. auth-service refuses a ticket, and a spent budget, the same way for
 * every address, so passing that on says nothing about which addresses have an account.
 */
export function resetCodeAnswer(
  result: ResetCodeResult,
  onTicket: boolean,
): { status: number; body: ResetCodeAnswer } {
  if (result.success) {
    return { status: 200, body: { sent: true, resendTicket: result.data?.resendTicket ?? null } };
  }
  if (!onTicket) {
    return { status: 200, body: { sent: true, resendTicket: null } };
  }
  return {
    status: 400,
    body: {
      code: result.code ?? "INTERNAL_ERROR",
      message: result.message ?? "Couldn't send a new code.",
    },
  };
}
