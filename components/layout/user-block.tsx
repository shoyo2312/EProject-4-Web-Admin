"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { AdminSession } from "@/lib/api/session";

function Initials({ initials }: { initials: string }) {
  return (
    <span className="relative shrink-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent uppercase">
        {initials}
      </span>
      <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-success" />
    </span>
  );
}

export function UserBlock({
  session,
  collapsed = false,
}: {
  session: AdminSession;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Tooltip label={`${session.username} — ${session.role}`} placement="right">
          <Initials initials={session.initials} />
        </Tooltip>
        <Tooltip label="Sign out" placement="right">
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-faint transition-colors hover:bg-sidebar-raised hover:text-sidebar-ink disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-sidebar-raised px-3 py-2.5">
      <Initials initials={session.initials} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{session.username}</span>
        <span className="block truncate text-[11px] text-sidebar-faint">{session.role}</span>
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-faint transition-colors hover:bg-sidebar-line hover:text-sidebar-ink disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
