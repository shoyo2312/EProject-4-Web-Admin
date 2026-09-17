import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { UsersTable } from "@/components/users/users-table";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, listUsers, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf, parsePage } from "@/lib/api/window";
import { formatNumber } from "@/lib/format";
import type { UserStatus } from "@/lib/api/types";

const STATUSES: UserStatus[] = ["ACTIVE", "BANNED", "LOCKED"];

function parseStatus(value: string | undefined): UserStatus | undefined {
  return STATUSES.includes(value as UserStatus) ? (value as UserStatus) : undefined;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; asOf?: string; page?: string }>;
}) {
  const { q, status, asOf: asOfParam, page: pageParam } = await searchParams;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);
  const pageIndex = parsePage(pageParam);

  let page;
  let bannedTotal;
  try {
    // Filtering and paging server-side rather than over the fetched rows: "show me every
    // banned account" must not depend on how many rows happened to come back, and the
    // directory is bigger than any one page.
    // The banned figure is its own count query for the same reason — counting the rows on
    // screen would report 3 out of a page of 25 as the platform's banned total.
    [page, bannedTotal] = await Promise.all([
      listUsers({ q, status: filter, page: pageIndex }),
      listUsers({ q, status: "BANNED", size: 1 }).then((p) => p.totalElements),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Users" />
        <ErrorState error={error} />
      </>
    );
  }

  // Registered on or before the picked date. Status is whatever it is now — this is a
  // joined-by filter, not a reconstruction of who was banned back then.
  // ponytail: the cut runs over the page rather than the query, because auth-service takes no
  // date parameter — a page of accounts newer than the picked date comes back short instead of
  // being skipped. Push a `createdBefore` param into AdminUserController if that starts to bite.
  const users = page.content.filter((u) => u.createdAt.slice(0, 10) <= asOf);
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
            <p className="label-caps text-ink-soft">Matching</p>
            <p className="figure mt-2 text-[24px] font-bold">
              {formatNumber(page.totalElements)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            <p className="label-caps text-ink-soft">Banned</p>
            <p className="figure mt-2 text-[24px] font-bold text-danger">
              {formatNumber(bannedTotal)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* Page-local, and labelled as such: auth-service has no emailVerified filter,
                so unlike Banned there is no count query to ask for the real total. */}
            <p className="label-caps text-ink-soft">Unverified Email</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(unverified)}
              <span className="ml-2 text-[11px] font-normal text-ink-faint">
                on this page
              </span>
            </p>
          </Card>
        </div>

        <UsersTable users={users} query={q ?? ""} status={filter ?? "ALL"} />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="accounts"
        />
      </div>
    </>
  );
}
