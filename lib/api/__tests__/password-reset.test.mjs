// Run: node lib/api/__tests__/password-reset.test.mjs
//
// Two things can go wrong here and neither shows in the UI by itself: a reset request that reads
// differently for an address with no account, and a refused resend ticket that the form never
// hears about, leaving "Send a new code" stuck on a ticket that will not work again.
import assert from "node:assert/strict";
import { resetCodeAnswer } from "../password-reset.ts";

const sent = (data) => ({ success: true, data, timestamp: "" });
const failed = (code, message) => ({ success: false, data: null, code, message, timestamp: "" });

// A code that went out hands the browser its resend ticket.
assert.deepEqual(resetCodeAnswer(sent({ resendTicket: "t1" }), false), {
  status: 200,
  body: { sent: true, resendTicket: "t1" },
});

// A resend on the ticket gets it back, and the form keeps whatever came last.
assert.deepEqual(resetCodeAnswer(sent({ resendTicket: "t1" }), true).body, {
  sent: true,
  resendTicket: "t1",
});

// An auth-service that predates the ticket answers `data: null`: sent, with nothing to resend on.
assert.deepEqual(resetCodeAnswer(sent(null), false).body, { sent: true, resendTicket: null });

// A failure on a Turnstile token reads exactly like a send. The form's copy already hedges, and
// an answer that differed by address would say which addresses have an account.
for (const code of ["TURNSTILE_VERIFICATION_FAILED", "TOO_MANY_OTP_REQUESTS", "VALIDATION_ERROR"]) {
  assert.deepEqual(resetCodeAnswer(failed(code, "no"), false), {
    status: 200,
    body: { sent: true, resendTicket: null },
  });
}

// A refused ticket is passed on, so the form can put the Turnstile check back up.
assert.deepEqual(
  resetCodeAnswer(failed("TURNSTILE_VERIFICATION_FAILED", "Turnstile verification required or failed"), true),
  {
    status: 400,
    body: { code: "TURNSTILE_VERIFICATION_FAILED", message: "Turnstile verification required or failed" },
  },
);

// So is a spent budget: "wait" is the instruction that helps, not another click.
assert.equal(
  resetCodeAnswer(failed("TOO_MANY_OTP_REQUESTS", "Too many"), true).body.code,
  "TOO_MANY_OTP_REQUESTS",
);

// An envelope with no code still names something the form can show.
assert.deepEqual(resetCodeAnswer({ success: false, data: null, timestamp: "" }, true).body, {
  code: "INTERNAL_ERROR",
  message: "Couldn't send a new code.",
});

console.log("password-reset checks passed");
