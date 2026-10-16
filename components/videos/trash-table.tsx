"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { moderateVideoAction } from "@/app/(admin)/videos/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { ReasonForm } from "@/components/moderation/reason-form";
import { PRESET_REASONS } from "@/lib/moderation";
import { TRASH_RETENTION_DAYS } from "@/lib/notifications";
import type { AdminVideoResponse, UserProfileResponse } from "@/lib/api/types";
import { daysUntilPurge, formatDateTime, shortId } from "@/lib/format";
import { hrefWith } from "@/lib/url";
import { usePropagation } from "@/lib/use-propagation";
import { cn } from "@/lib/utils";

export function TrashTable({
  videos,
  owners,
  query,
  now,
}: {
  videos: AdminVideoResponse[];
  /** userId → profile, for showing the owner as @handle. May be missing an id. */
  owners: Record<string, UserProfileResponse>;
  query: string;
  /** The server's clock, so the days left render the same on the server and in the browser. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNavigation] = useTransition();

  function search(term: string) {
    const href = hrefWith(pathname, params, { q: term || null, page: null });
    startNavigation(() => router.replace(href as never));
  }

  return (
    <Card>
      <CardHeader
        title="Deleted by their owners"
        hint={`The media stays in storage, and playable here, until its ${TRASH_RETENTION_DAYS} days run out — then it is erased for good.`}
        actions={
          <SearchBox query={query} onCommit={search} placeholder="Search title or owner..." />
        }
      />

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Title</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft md:table-cell">Owner</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft md:table-cell">Deleted</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Time left</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <TrashRow key={video.id} video={video} owner={owners[video.userId]} now={now} />
            ))}

            {videos.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-faint">
                  The trash is empty.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TrashRow({
  video,
  owner,
  now,
}: {
  video: AdminVideoResponse;
  owner?: UserProfileResponse;
  now: number;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  // The row leaves the listing once the purge goes out, so until then it stays and says so.
  const { pending, stalled, watch } = usePropagation(
    video.purgeEventPublishedAt,
    "Still in the trash — video-service has not purged it yet. The deletion is recorded; reload in a moment.",
  );

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateVideoAction(video.id, "purge", reason ?? "");
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        watch();
      }
    });
  }

  return (
    <>
      <tr className="border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted">
        <td className="max-w-[320px] px-5 py-3">
          {/* The video's own page plays it — that is where an admin reviews what is in here. */}
          <Link
            href={`/videos/${video.id}` as never}
            className="block truncate font-medium underline-offset-4 hover:underline"
            title={video.title}
          >
            {video.title || "(untitled upload)"}
          </Link>
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap md:table-cell">
          {owner?.username ? (
            <span className="text-ink-soft">@{owner.username}</span>
          ) : (
            <span className="figure text-ink-faint">#{shortId(video.userId.slice(-8), 8)}</span>
          )}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap text-ink-faint md:table-cell">
          {video.deletedAt ? formatDateTime(video.deletedAt) : "—"}
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          {pending ? (
            <span className="text-ink-faint">deleting…</span>
          ) : video.deletedAt ? (
            daysUntilPurge(video.deletedAt, TRASH_RETENTION_DAYS, now)
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-3 pr-5 text-right">
          <button
            type="button"
            // Disabled while the purge is on its way, so the same deletion cannot be queued twice.
            disabled={pending}
            onClick={() => setReason(reason === null ? "" : null)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
              pending ? "cursor-not-allowed text-ink-faint" : "text-danger hover:bg-surface",
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete now
          </button>
        </td>
      </tr>

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={5} className="px-5 py-3">
            <ReasonForm
              presets={PRESET_REASONS.purge}
              reason={reason}
              onReason={setReason}
              onSubmit={submit}
              onCancel={() => setReason(null)}
              submitting={submitting}
              placeholder={`Why "${video.title}" cannot wait out its ${TRASH_RETENTION_DAYS} days — this is permanent`}
              confirmLabel="Delete permanently"
            />
          </td>
        </tr>
      ) : null}

      {(stalled ?? result) ? (
        <tr className="border-b border-line">
          <td colSpan={5} className="px-5 py-2 text-[11px] text-ink-soft">
            {stalled ?? result}
          </td>
        </tr>
      ) : null}
    </>
  );
}
