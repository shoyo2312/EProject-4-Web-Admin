import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import type { DeadLetterTopicResponse } from "@/lib/api/types";
import { deadLetterHealth, deadLetterHref } from "@/lib/dead-letters";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ToneBadge } from "./tone-badge";

const COLUMNS = 4;

/** Every `<topic>.DLT` on the broker, the ones with records waiting on a replay first in mind. */
export function DeadLetterTopicsCard({ topics, now }: { topics: DeadLetterTopicResponse[]; now: number }) {
  const health = deadLetterHealth(topics);

  return (
    <Card>
      <CardHeader
        title="Dead-letter topics"
        hint="Records a consumer gave up on after its retries — a bug or a malformed event, never an outage, which is retried in place. Nothing replays them on its own: each one is an event every consumer of its topic missed. Fix the cause and deploy first, then replay."
        actions={<ToneBadge tone={health.tone}>{health.text}</ToneBadge>}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[640px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Topic</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Pending</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Held by Kafka</th>
              <th className="label-caps px-5 py-3 text-ink-soft">Last parked</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.topic} className="border-b border-line align-top last:border-b-0">
                <td className="px-5 py-3">
                  <Link href={deadLetterHref(topic.topic) as never} className="font-medium hover:underline">
                    {topic.originTopic}
                  </Link>
                  <p className="text-[11px] text-ink-faint">{topic.topic}</p>
                </td>
                <td className={cn("figure px-3 py-3", topic.pending > 0 && "text-danger")}>
                  {formatNumber(topic.pending)}
                </td>
                <td className="figure px-3 py-3 text-ink-soft">{formatNumber(topic.retained)}</td>
                <td className="px-5 py-3 whitespace-nowrap text-ink-soft">
                  {topic.latestAt ? (
                    <span title={formatDateTime(topic.latestAt)}>{relativeTime(topic.latestAt, now)}</span>
                  ) : (
                    <span className="text-ink-faint" title="Retention has dropped every record">
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {topics.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-10 text-center text-ink-faint">
                  No consumer has parked a record yet — a dead-letter topic only appears once one does.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
