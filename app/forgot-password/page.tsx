import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { GATEWAY_URL } from "@/lib/api/config";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      lead="A code is emailed to the account's address, then a new password replaces the old one."
      foot={
        <>
          Requests go through <code>{GATEWAY_URL}</code>.
        </>
      }
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
