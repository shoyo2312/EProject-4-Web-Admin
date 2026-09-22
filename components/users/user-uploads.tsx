import Link from "next/link";
import { Eye, Heart, Play } from "lucide-react";
import { VIDEO_STATUS_STYLES } from "@/components/ui/status-badge";
import type { AdminVideoResponse } from "@/lib/api/types";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** This account's uploads, shown right on its own page rather than sending the admin to a search. */
export function UserUploads({ videos }: { videos: AdminVideoResponse[] }) {
  if (videos.length === 0) {
    return (
      <p className="px-5 py-6 text-center text-[12px] text-ink-faint">
        No uploads from this account.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 p-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
      {videos.map((video) => (
        <Link
          key={video.id}
          href={`/videos/${video.id}` as never}
          className="group overflow-hidden rounded-lg border border-line bg-surface-muted transition-colors hover:border-line-strong"
        >
          <div className="relative aspect-[9/16] bg-neutral-bg">
            {/* A deleted video sits in a 30-day trash window with its media intact — deletedAt
                alone does not mean the file is gone. deleteEventPublishedAt is what tells us
                media-worker has actually consumed the delete event and erased it from MinIO;
                only then is thumbnailUrl a dangling reference. */}
            {video.thumbnailUrl && !video.deleteEventPublishedAt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Play className="h-4 w-4 text-ink-faint" />
              </div>
            )}
            {/* A deleted video keeps its pre-deletion status (PUBLISHED, TAKEN_DOWN, ...) on
                the record — showing that here would read as still live. */}
            <span
              className={cn(
                "absolute top-1 left-1 rounded border px-1 py-0.5 text-[8px] leading-none font-medium",
                video.deletedAt
                  ? "border-danger/25 bg-danger-bg text-danger"
                  : VIDEO_STATUS_STYLES[video.status],
              )}
            >
              {video.deletedAt ? "DELETED" : video.status}
            </span>
          </div>
          <div className="px-1.5 py-1">
            <p className="truncate text-[10px] font-medium">{video.title}</p>
            <p className="flex items-center gap-1.5 truncate text-[9px] text-ink-faint">
              <span className="inline-flex items-center gap-0.5">
                <Eye className="h-2.5 w-2.5" />
                {formatCount(video.viewCount)}
              </span>
              <span className="inline-flex items-center gap-0.5">
                <Heart className="h-2.5 w-2.5 fill-current" />
                {formatCount(video.likeCount)}
              </span>
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
