import { MessageSquare } from "lucide-react";
import { CommentsTable } from "@/components/comments/comments-table";
import { VideoPicker } from "@/components/comments/video-picker";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { listComments, listVideos } from "@/lib/api/admin";

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; videoId?: string }>;
}) {
  const { q, videoId } = await searchParams;

  let videos;
  let comments = null;
  try {
    videos = await listVideos({ q, size: 100 });
    // Only a video that is actually in the list may be opened: a videoId left in the URL from a
    // previous search would otherwise render a thread with nothing selected beside it.
    const selected = videoId && videos.some((v) => v.id === videoId) ? videoId : null;
    comments = selected ? await listComments(selected) : null;
  } catch (error) {
    return (
      <>
        <PageHeader title="Comments" />
        <ErrorState error={error} />
      </>
    );
  }

  const selected = videos.find((v) => v.id === videoId && comments !== null) ?? null;

  return (
    <>
      <PageHeader
        title="Comments"
        subtitle="Read a video's thread and remove a comment on a user's behalf. Removals are recorded in the audit log; there is no undo."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
        <VideoPicker videos={videos} query={q ?? ""} selectedId={selected?.id ?? null} />

        {selected && comments ? (
          <CommentsTable comments={comments} videoTitle={selected.title} />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <MessageSquare className="h-5 w-5 text-ink-faint" />
            <p className="text-[12px] text-ink-soft">Pick a video to read its thread.</p>
            <p className="max-w-sm text-[11px] text-ink-faint">
              There is no platform-wide comment feed: interaction-service stores comments
              partitioned by video, so a thread is only reachable through the video it is on.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
