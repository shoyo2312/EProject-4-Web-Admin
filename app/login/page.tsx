import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { GATEWAY_URL } from "@/lib/api/config";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      lead="Use your admin account. A code is emailed on a device the console has not seen before."
      foot={
        <>
          Requires an account with role ADMIN. Signing in goes through <code>{GATEWAY_URL}</code>.
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
