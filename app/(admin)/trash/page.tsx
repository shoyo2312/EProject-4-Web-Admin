import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { TrashTable } from "@/components/videos/trash-table";
import { Pager } from "@/components/ui/pager";
import { getUserProfiles } from "@/lib/api/names";
import { LIST_PAGE_SIZE, referenceNow } from "@/lib/api/shared";
import { resolveOwners } from "@/lib/api/users";
import { listVideos } from "@/lib/api/videos";
import { parsePage } from "@/lib/api/window";
import { trashFilters } from "@/lib/list-filters";
import { TRASH_RETENTION_DAYS } from "@/lib/notifications";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, sort, ascending } = trashFilters(params);

  let page;
  try {
    const ownerIds = q ? await resolveOwners(q) : [];
    // Deleted but not yet purged: a purged video has nothing left to watch, so it is no longer
    // in the trash. Soonest to expire first unless a header picks another order.
    page = await listVideos({
      q,
      ownerIds,
      deleted: true,
      purged: false,
      sort: `${sort},${ascending ? "asc" : "desc"}`,
      page: parsePage(params.page),
    });
  } catch (error) {
    return (
      <>
        <PageHeader title="Trash" />
        <ErrorState error={error} />
      </>
    );
  }

  const owners = await getUserProfiles(page.content.map((v) => v.userId)).catch(() => ({}));

  return (
    <>
      <PageHeader
        title="Trash"
        subtitle={`Videos their owners deleted. Each stays watchable here for ${TRASH_RETENTION_DAYS} days, then its media is erased for good — or delete it now.`}
      />

      <div className="stagger space-y-4">
        <TrashTable
          videos={page.content}
          owners={owners}
          query={q ?? ""}
          sort={{ field: sort, ascending }}
          now={referenceNow()}
        />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="videos"
        />
      </div>
    </>
  );
}
