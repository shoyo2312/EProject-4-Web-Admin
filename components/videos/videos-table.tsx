"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { Segmented } from "@/components/ui/segmented";
import { VideoRow } from "@/components/videos/videos-table/video-row";
import type { AdminVideoResponse, UserProfileResponse, VideoStatus } from "@/lib/api/types";
import { shortId } from "@/lib/format";
import { VIDEO_STATUS_LABELS, statusTabs } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

type StatusFilter = VideoStatus | "ALL" | "DELETED";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  // PENDING_REVIEW first after All: this is the one filter that is a worklist rather than a
  // report — every row in it is a video nobody can see until someone acts.
  ...statusTabs(
    ["PENDING_REVIEW", "PUBLISHED", "PROCESSING", "FAILED", "REJECTED", "TAKEN_DOWN"],
    VIDEO_STATUS_LABELS,
  ),
  // Not a VideoStatus — a video keeps its pipeline status after its owner deletes it, so this
  // filters on deletedAt instead. The page translates it to listVideos({ deleted: true }).
  { value: "DELETED", label: "Deleted" },
];

export function VideosTable({
  videos,
  owners,
  query,
  ownerId,
  status,
  now,
}: {
  videos: AdminVideoResponse[];
  /** userId → profile, for showing the owner as @handle. May be missing an id. */
  owners: Record<string, UserProfileResponse>;
  query: string;
  /** The exact owner filter, when the list was opened from an account's uploads. */
  ownerId: string | null;
  status: StatusFilter;
  /** `referenceNow()`, from the server — the purge countdown is measured against it. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNavigation] = useTransition();

  // Back to the first page: page 3 of everything is not page 3 of one owner's uploads.
  const filterHref = (patch: Record<string, string | null>) =>
    hrefWith(pathname, params, { ...patch, page: null });

  function go(patch: Record<string, string | null>) {
    startNavigation(() => router.replace(filterHref(patch) as never));
  }

  return (
    <Card>
      <CardHeader
        title="Uploads"
        hint="Every upload, in every state. Click a row for its details; a takedown is recorded in the audit log."
        actions={
          <>
            {ownerId ? (
              <Link
                href={filterHref({ owner: null }) as never}
                title="Show every owner's uploads"
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[11px] text-ink-soft hover:text-ink"
              >
                {owners[ownerId]?.username
                  ? `@${owners[ownerId].username}`
                  : `#${shortId(ownerId.slice(-8), 8)}`}
                <X className="h-3 w-3" />
              </Link>
            ) : null}
            <SearchBox
              query={query}
              // A search replaces the owner filter rather than narrowing it: video-service reads
              // a term and an owner list as one search, so the two together would widen it.
              onCommit={(term) => go({ q: term || null, owner: null })}
              placeholder="Search title or owner..."
            />
            <Segmented
              options={STATUS_FILTERS}
              value={status}
              onChange={(next) => go({ status: next === "ALL" ? null : next })}
            />
          </>
        }
      />

      {/* Columns come and go with the width of this box, not of the window: at 1280px the
          expanded sidebar leaves the table about 970px, and every column it held at "xl" pushed
          the actions off the right edge. What a narrow box drops is still in the expand row. */}
      <div className={cn("@container overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Title</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft @4xl:table-cell">Owner</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Status</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft @6xl:table-cell">Visibility</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Reason</th>
              <th className="label-caps hidden px-3 py-3 text-right text-ink-soft @4xl:table-cell">Views</th>
              <th className="label-caps hidden px-3 py-3 text-right text-ink-soft @6xl:table-cell">Likes</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft @5xl:table-cell">Uploaded</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <VideoRow key={video.id} video={video} owner={owners[video.userId]} now={now} />
            ))}

            {videos.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink-faint">
                  No uploads match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
