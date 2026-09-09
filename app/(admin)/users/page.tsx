import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/components/users/users-table";
import { Card } from "@/components/ui/card";
import { listUsers, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf } from "@/lib/api/window";
import { formatNumber } from "@/lib/format";
import type { UserStatus } from "@/lib/api/types";

const STATUSES: UserStatus[] = ["ACTIVE", "BANNED", "LOCKED"];

function parseStatus(value: string | undefined): UserStatus | undefined {
  return STATUSES.includes(value as UserStatus) ? (value as UserStatus) : undefined;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; asOf?: string }>;
}) {
  const { q, status, asOf: asOfParam } = await searchParams;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);

  let users;
  try {
    // Filtering server-side rather than over the fetched page: "show me every banned account"
    // must not depend on how many rows happened to come back.
    // Registered on or before the picked date. Status is whatever it is now — this is
    // a joined-by filter, not a reconstruction of who was banned back then.
    users = (await listUsers({ q, status: filter, size: 100 })).filter(
      (u) => u.createdAt.slice(0, 10) <= asOf,
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Users" />
        <ErrorState error={error} />
      </>
    );
  }

  const banned = users.filter((u) => u.status === "BANNED").length;
  const unverified = users.filter((u) => !u.emailVerified).length;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Every account on the platform. Banning writes a moderation action and revokes live sessions."
        filters={{ asOf, latest }}
        csv={{ name: "users", rows: users }}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="px-5 py-4">
            <p className="label-caps text-ink-soft">Listed</p>
            <p className="figure mt-2 text-[24px] font-bold">
              {formatNumber(users.length)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            <p className="label-caps text-ink-soft">Banned</p>
            <p className="figure mt-2 text-[24px] font-bold text-danger">
              {formatNumber(banned)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            <p className="label-caps text-ink-soft">Unverified Email</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(unverified)}
            </p>
          </Card>
        </div>

        <UsersTable users={users} query={q ?? ""} status={filter ?? "ALL"} />
      </div>
    </>
  );
}
