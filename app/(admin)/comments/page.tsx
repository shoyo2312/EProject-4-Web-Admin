import { CommentsTable } from "@/components/comments/comments-table";
import { ReportedComments } from "@/components/comments/reported-comments";
import { VideoPicker } from "@/components/comments/video-picker";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  decorateCommentPage,
  getComments,
  getReportedCommentDetails,
  listComments,
} from "@/lib/api/comments";
import { getHandles } from "@/lib/api/names";
import { listReportQueue } from "@/lib/api/reports";
import type { AdminCommentFilter } from "@/lib/api/types";
import { resolveOwners } from "@/lib/api/users";
import { getVideo, listVideos } from "@/lib/api/videos";
import type { CommentPageView, ReportedCommentDetails } from "@/lib/comments";
import { plural } from "@/lib/format";
import { reportedComments, reportedPerVideo, type ReportedComment } from "@/lib/moderation";

const FILTERS: AdminCommentFilter[] = ["THREAD", "REPLIES", "REMOVED", "HELD"];

/** video-service and admin-service both cap a page at fifty. */
const RAIL_SIZE = 50;
const QUEUE_WINDOW = 50;

/** Each one's comment is read back from its video's partition, against the gateway's rate limit. */
const WORKLIST_SIZE = 12;

/**
 * A place to work rather than a place to read figures, so nothing on it is dated and it has no
 * period to pick: threads and the queue are as they stand now, and the record of what was removed
 * and when is the Audit Log, which has the period picker and the same count.
 */
export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    videoId?: string;
    /** A comment to pin above the thread — where a report or a notification on one lands. */
    comment?: string;
    filter?: string;
  }>;
}) {
  const params = await searchParams;
  const { q, videoId, filter, comment: linkedId } = params;
  // A filter left in the URL by hand has to resolve to something real: it is passed straight to
  // interaction-service, which rejects anything the enum does not name.
  const selectedFilter = FILTERS.find((f) => f === filter) ?? "THREAD";

  let videos;
  let total;
  let queue;
  let handles;
  let reported: ReportedComment[] = [];
  let comments: CommentPageView | null = null;
  let pinned: CommentPageView | null | undefined;
  let details: ReportedCommentDetails | null = null;
  try {
    const ownerIds = q ? await resolveOwners(q) : [];
    const [matches, queuePage] = await Promise.all([
      // Biggest threads first: a list of the newest uploads opened on videos nobody has commented
      // on, and a thread that long is where moderation is likeliest to be needed. The picker is a
      // search box, not a directory: the matches that fit the rail, narrowed with q rather than
      // paged through.
      listVideos({ q, ownerIds, deleted: false, sort: "commentCount,desc", size: RAIL_SIZE }),
      // Reading a thread does not need the queue, so the queue being down must not fail the page.
      listReportQueue({ size: QUEUE_WINDOW }).catch(() => null),
    ]);
    queue = queuePage;
    videos = matches.content;
    total = matches.totalElements;
    reported = reportedComments(queue?.content ?? []);

    // A video linked to directly — from its own page, or a report on one of its comments — may be
    // past what the rail holds, or deleted, so it is looked up by id and joins the top of the rail.
    if (videoId && !q && !videos.some((v) => v.id === videoId)) {
      const linked = await getVideo(videoId);
      if (linked) videos = [linked, ...videos];
    }
    handles = await getHandles(videos.map((v) => v.userId));

    // Only a video that is actually in the list may be opened: a videoId beside a search it does
    // not match would otherwise render a thread with nothing selected beside it.
    const selected = videoId && videos.some((v) => v.id === videoId) ? videoId : null;
    if (selected) {
      const pinIds = [
        ...reported.filter((r) => r.videoId === selected).map((r) => r.commentId),
        ...(linkedId ? [linkedId] : []),
      ];
      // Only the first page. The rest is pulled in by the table as the admin asks for it — a thread
      // can run to thousands, and before this it was read as one slab and silently cut off at 50.
      comments = await decorateCommentPage(
        selected,
        await listComments(selected, { filter: selectedFilter }),
      );
      // By id, because a thread is paged newest first and a comment reported last month would
      // otherwise be any number of Load more clicks down. A failed lookup is null rather than a
      // failed page — the thread is still worth showing.
      if (pinIds.length > 0) {
        const found = await getComments(selected, pinIds).catch(() => null);
        pinned = found
          ? await decorateCommentPage(selected, { items: found, nextCursor: null, hasMore: false })
          : null;
      }
    } else if (reported.length > 0) {
      details = await getReportedCommentDetails(reported.slice(0, WORKLIST_SIZE));
    }
  } catch (error) {
    return (
      <>
        <PageHeader title="Comments" />
        <ErrorState error={error} />
      </>
    );
  }

  const selected = videos.find((v) => v.id === videoId && comments !== null) ?? null;
  // The queue holds more targets than were read, so more comments may be waiting than were found.
  const partial = queue !== null && queue.totalElements > queue.content.length;

  return (
    <>
      <PageHeader
        title="Comments"
        subtitle="Reported comments come first; any other thread opens from its video. Every removal is recorded in the audit log, and there is no undo."
      />

      <div className="stagger grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
        <VideoPicker
          videos={videos}
          total={total}
          query={q ?? ""}
          selectedId={selected?.id ?? null}
          handles={handles}
          reportedPerVideo={reportedPerVideo(reported)}
          waiting={
            queue === null
              ? null
              : reported.length === 0
                ? "Nothing waiting"
                : `${reported.length}${partial ? "+" : ""} ${plural(reported.length, "comment")} waiting for a decision`
          }
        />

        {selected && comments ? (
          <CommentsTable
            key={`${selected.id}:${selectedFilter}`}
            page={comments}
            video={selected}
            creator={handles[selected.userId]}
            filter={selectedFilter}
            pinned={pinned}
            reports={reported.filter((r) => r.videoId === selected.id)}
            linkedId={linkedId ?? null}
          />
        ) : (
          <ReportedComments
            reported={reported}
            shown={WORKLIST_SIZE}
            details={details}
            partial={partial}
            failed={queue === null}
          />
        )}
      </div>
    </>
  );
}
