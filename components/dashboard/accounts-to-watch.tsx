import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { WatchedAccount } from "@/lib/dashboard";
import { formatNumber, plural, shortId } from "@/lib/format";

export function AccountsToWatch({
  accounts,
  handles,
}: {
  /** Null when neither held videos nor the report queue could be read. */
  accounts: WatchedAccount[] | null;
  handles: Record<string, string>;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Accounts to watch"
        hint="The accounts behind the most open work right now: their uploads held for review, plus standing reports against the account or its videos. Read from the first 50 held videos and the first 50 rows of the report queue."
      />
      {accounts === null || accounts.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12px] text-ink-faint">
          {accounts === null
            ? "The queues could not be read."
            : "No account has held uploads or standing reports."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {accounts.map((account) => {
            const handle = handles[account.userId];
            return (
              <li key={account.userId}>
                <Link
                  href={`/users/${account.userId}` as never}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-ink-soft uppercase">
                    {handle ? handle.replace(/^@/, "").slice(0, 2) : "#"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {handle ?? `#${shortId(account.userId.slice(-8), 8)}`}
                    </span>
                    <span className="block text-[12px] text-ink-faint">
                      {formatNumber(account.held)} held · {formatNumber(account.reports)}{" "}
                      {plural(account.reports, "report")}
                    </span>
                  </span>
                  <span className="figure shrink-0 rounded-full bg-pending-bg px-2 py-0.5 text-[12px] font-medium text-pending">
                    {formatNumber(account.held + account.reports)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
