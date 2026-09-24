import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { TrashTable } from "@/components/videos/trash-table";
import { Pager } from "@/components/ui/pager";
import {
  LIST_PAGE_SIZE,
  getUserProfiles,
  listVideos,
  referenceNow,
  resolveOwners,
} from "@/lib/api/admin";
import { parsePage } from "@/lib/api/window";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;

  let page;
  try {
    const ownerIds = q ? await resolveOwners(q) : [];
    // Deleted but not yet purged: a purged video has nothing left to watch, so it is no longer
    // in the trash. Soonest to expire first — those are the ones an admin still has to look at.
    page = await listVideos({
      q,
      ownerIds,
      deleted: true,
      purged: false,
      sort: "deletedAt,asc",
      page: parsePage(pageParam),
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
        subtitle="Videos their owners deleted. Each stays watchable here for 30 days, then its media is erased for good — or delete it now."
      />

      <div className="space-y-4">
        <TrashTable
          videos={page.content}
          owners={owners}
          query={q ?? ""}
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
