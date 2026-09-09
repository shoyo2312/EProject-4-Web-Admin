import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GATEWAY_URL } from "@/lib/api/config";

/**
 * Shown instead of a blank panel when a live call fails. Names the gateway and the
 * service error code, because "something went wrong" is useless when six services
 * have to be running for a page to load.
 */
export function ErrorState({ error }: { error: unknown }) {
  // A 401 here means the token was accepted by the gate (cookie still within its
  // maxAge) but rejected by the gateway — revoked server-side by a ban, a replay,
  // or a password reset. There is nothing to retry: send the operator back to
  // sign in. `?expired` tells middleware to clear the dead cookie rather than
  // bounce straight back to /dashboard. redirect() throws, so it runs before any
  // of the markup below and past the page's own try/catch (which already ran).
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 401
  ) {
    redirect("/login?expired=1");
  }

  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : null;

  return (
    <Card className="max-w-3xl px-6 py-6">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <h2 className="label-caps text-ink">Could not load</h2>
        {code ? (
          <code className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] text-ink-soft">
            {code}
          </code>
        ) : null}
      </div>

      <p className="mt-3 text-[12px] text-ink-soft">{message}</p>

      <ul className="mt-4 space-y-2 text-[11px] text-ink-soft">
        <li className="rounded-lg border border-line bg-surface-muted px-3 py-2">
          Gateway: <code>{GATEWAY_URL}</code> — start it with{" "}
          <code>make run-gateway</code>
        </li>
        <li className="rounded-lg border border-line bg-surface-muted px-3 py-2">
          This page needs <code>make run-admin</code> and{" "}
          <code>make run-analytics</code>, plus <code>make infra-up</code>
        </li>
        <li className="rounded-lg border border-line bg-surface-muted px-3 py-2">
          Set <code>ADMIN_USE_MOCK=true</code> in <code>.env.local</code> to work
          against mock data instead
        </li>
      </ul>
    </Card>
  );
}
