import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { TopVideoResponse } from "@/lib/api/types";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import type { RowNames } from "@/lib/names";

/**
 * The most-watched videos of the window.
 *
 * Ranked on watch time, not views: a view is recorded for a three-second bounce and for a full
 * play alike, and the list ordered on it is a list of thumbnails people clicked. Completion is
 * shown beside it for the same reason — it is what separates a video that held an audience from
 * one that merely collected them.
 *
 * ClickHouse stores what was watched, not what it was called, so the page names the rows from
 * one batch lookup. That lookup only sees videos that are public right now — one taken down since
 * keeps its id here, and its own page, one click away, still reads it.
 */
export function TopVideos({
  rows,
  period,
  names,
}: {
  rows: TopVideoResponse[];
  /** The days the list covers, in the words the page header uses. */
  period: string;
  /** Titles and posters by video id; owner @handles by user id. */
  names: RowNames;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Most watched"
        hint={`Ranked by total time watched over ${period}, not by views — a three-second bounce counts as a view too.`}
      />

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[12px] text-ink-faint">
          No watch events in this window.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps px-5 py-2.5 font-medium text-ink-soft">#</th>
                <th className="label-caps px-3 py-2.5 font-medium text-ink-soft">Video</th>
                <th className="label-caps px-3 py-2.5 text-right font-medium text-ink-soft">
                  Watch time
                </th>
                <th className="label-caps px-3 py-2.5 text-right font-medium text-ink-soft">
                  Views
                </th>
                <th className="label-caps px-3 py-2.5 text-right font-medium text-ink-soft">
                  Viewers
                </th>
                <th className="label-caps px-5 py-2.5 text-right font-medium text-ink-soft">
                  Finished
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const video = names.videos[row.videoId];
                const owner = video ? names.handles[video.userId] : undefined;
                return (
                <tr key={row.videoId} className="border-b border-line last:border-0">
                  <td className="figure px-5 py-2.5 text-ink-faint">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/videos/${row.videoId}` as never}
                      className="group flex items-center gap-3"
                    >
                      <VideoThumb src={video?.thumbnailUrl ?? null} className="h-10 w-7" />
                      <span className="min-w-0">
                        {video?.title ? (
                          <span className="block max-w-[360px] truncate font-medium underline-offset-4 group-hover:underline">
                            {video.title}
                          </span>
                        ) : (
                          <span className="figure block underline-offset-4 group-hover:underline">
                            {row.videoId}
                          </span>
                        )}
                        <span className="block text-[11px] text-ink-faint">
                          {video ? (owner ?? "") : "not public right now"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="figure px-3 py-2.5 text-right">{hours(row.watchedMs)}</td>
                  <td className="figure px-3 py-2.5 text-right">{formatNumber(row.views)}</td>
                  <td className="figure px-3 py-2.5 text-right text-ink-soft">
                    {formatCompact(row.viewers)}
                  </td>
                  <td className="figure px-5 py-2.5 text-right text-ink-soft">
                    {formatPercent(row.completions, row.views)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Milliseconds are unreadable at this scale; minutes stop being readable past a few hours. */
function hours(ms: number): string {
  const minutes = ms / 60_000;
  return minutes < 90 ? `${Math.round(minutes)}m` : `${(minutes / 60).toFixed(1)}h`;
}
