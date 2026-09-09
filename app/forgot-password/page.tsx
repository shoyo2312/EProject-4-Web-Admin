import { Suspense } from "react";
import { KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Card } from "@/components/ui/card";
import { GATEWAY_URL } from "@/lib/api/config";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-surface">
            <KeyRound className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] tracking-wider text-ink-faint">CONSOLE</p>
            <h1 className="text-[16px] font-bold">Reset password</h1>
          </div>
        </div>

        <Card className="px-5 py-5">
          <Suspense>
            <ForgotPasswordForm />
          </Suspense>
          <p className="mt-4 border-t border-line pt-3 text-[10px] text-ink-faint">
            A code is emailed to the account address. Requests go through{" "}
            <code>{GATEWAY_URL}</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
