import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { TopVideoResponse } from "@/lib/api/types";
import { formatCompact, formatNumber } from "@/lib/format";

/**
 * The most-watched videos of the window.
 *
 * Ranked on watch time, not views: a view is recorded for a three-second bounce and for a full
 * play alike, and the list ordered on it is a list of thumbnails people clicked. Completion is
 * shown beside it for the same reason — it is what separates a video that held an audience from
 * one that merely collected them.
 *
 * Ids rather than titles: this comes from ClickHouse, which stores what was watched and not what
 * it was called, and there is no batch title lookup to ask. The link goes to the video's page,
 * where the title is the heading.
 */
export function TopVideos({ rows, days }: { rows: TopVideoResponse[]; days: number }) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Most watched"
        hint={`GET /api/v1/analytics/videos/top?days=${days} — ordered by time spent watching`}
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
              {rows.map((row, index) => (
                <tr key={row.videoId} className="border-b border-line last:border-0">
                  <td className="figure px-5 py-2.5 text-ink-faint">{index + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/videos/${row.videoId}` as never}
                      className="figure underline-offset-4 hover:underline"
                    >
                      {row.videoId}
                    </Link>
                  </td>
                  <td className="figure px-3 py-2.5 text-right">{hours(row.watchedMs)}</td>
                  <td className="figure px-3 py-2.5 text-right">{formatNumber(row.views)}</td>
                  <td className="figure px-3 py-2.5 text-right text-ink-soft">
                    {formatCompact(row.viewers)}
                  </td>
                  <td className="figure px-5 py-2.5 text-right text-ink-soft">
                    {percent(row.completions, row.views)}
                  </td>
                </tr>
              ))}
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

function percent(part: number, whole: number): string {
  // An em dash, not 0%: no views is no answer about how many of them finished.
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}
