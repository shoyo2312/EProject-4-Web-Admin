import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { GATEWAY_URL } from "@/lib/api/config";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-surface">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] tracking-wider text-ink-faint">CONSOLE</p>
            <h1 className="text-[16px] font-bold">TikTok Admin</h1>
          </div>
        </div>

        <Card className="px-5 py-5">
          <Suspense>
            <LoginForm />
          </Suspense>
          <p className="mt-4 border-t border-line pt-3 text-[10px] text-ink-faint">
            Requires an account with role ADMIN. Signing in goes through{" "}
            <code>{GATEWAY_URL}</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
