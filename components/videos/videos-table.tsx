"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { bulkModerateVideosAction } from "@/app/(admin)/videos/actions";
import { BulkBar, SelectAllCell, type BulkAction } from "@/components/moderation/bulk-bar";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { Segmented } from "@/components/ui/segmented";
import { DECISIONS, VideoRow } from "@/components/videos/videos-table/video-row";
import { PRESET_REASONS, videoDecisions, type VideoDecision } from "@/lib/moderation";
import type { AdminVideoResponse, UserProfileResponse, VideoStatus } from "@/lib/api/types";
import { shortId } from "@/lib/format";
import { VIDEO_STATUS_LABELS, statusTabs } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { useBulkPropagation } from "@/lib/use-propagation";
import { useSelection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";

type StatusFilter = VideoStatus | "ALL" | "DELETED";

/** A held video counts toward both of its answers; every other state toward its one. */
type BulkDecision = VideoDecision | "reject";
const BULK_DECISIONS: readonly BulkDecision[] = ["approve", "reject", "takedown", "restore"];

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

  // A deleted video cannot be moderated: video-service only writes to rows with no deletedAt.
  const selection = useSelection();
  const bulk = useBulkPropagation();
  const selectable = videos.filter(
    (video) => !video.deletedAt && !bulk.pending(video.id, video.status),
  );
  const ticked = selectable.filter((video) => selection.selected.has(video.id));
  const tickedFor = (decision: BulkDecision) =>
    ticked.filter((video) => videoDecisions(video.status).includes(decision));
  const bulkActions: BulkAction<BulkDecision>[] = BULK_DECISIONS.map((decision) => ({
    key: decision,
    label: DECISIONS[decision].label,
    count: tickedFor(decision).length,
    presets: PRESET_REASONS[decision],
    confirm: DECISIONS[decision].confirm,
    tone: decision === "approve" ? "success" : decision === "restore" ? undefined : "danger",
  }));

  async function runBulk(decision: BulkDecision, reason: string) {
    const rows = tickedFor(decision);
    const outcome = await bulkModerateVideosAction(rows.map((video) => video.id), decision, reason);
    const failed = new Set(outcome.failedIds);
    bulk.watch(rows.filter((video) => !failed.has(video.id)).map((video) => [video.id, video.status]));
    // What this run did not cover stays ticked — the other decision's rows, and the failures.
    selection.set(
      ticked.filter((video) => !rows.includes(video) || failed.has(video.id)).map((video) => video.id),
    );
    return outcome;
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
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 text-[12px] text-ink-soft hover:text-ink"
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

      <BulkBar
        count={ticked.length}
        actions={bulkActions}
        onRun={runBulk}
        onClear={selection.clear}
      />

      {/* Columns come and go with the width of this box, not of the window: at 1280px the
          expanded sidebar leaves the table about 970px, and every column it held at "xl" pushed
          the actions off the right edge. What a narrow box drops is still in the expand row. */}
      <div className={cn("@container overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              <SelectAllCell ids={selectable.map((video) => video.id)} selection={selection} />
              <th className="label px-3 py-3 text-ink-soft">Title</th>
              <th className="label hidden px-3 py-3 text-ink-soft @4xl:table-cell">Owner</th>
              <th className="label px-3 py-3 text-ink-soft">Status</th>
              <th className="label hidden px-3 py-3 text-ink-soft @6xl:table-cell">Visibility</th>
              <th className="label px-3 py-3 text-ink-soft">Reason</th>
              <th className="label hidden px-3 py-3 text-right text-ink-soft @4xl:table-cell">Views</th>
              <th className="label hidden px-3 py-3 text-right text-ink-soft @6xl:table-cell">Likes</th>
              <th className="label hidden px-3 py-3 text-ink-soft @5xl:table-cell">Uploaded</th>
              <th className="label px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                owner={owners[video.userId]}
                now={now}
                selection={selection}
                bulkPending={bulk.pending(video.id, video.status)}
              />
            ))}

            {videos.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-ink-faint">
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
