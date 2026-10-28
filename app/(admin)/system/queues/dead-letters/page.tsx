import { redirect } from "next/navigation";
import { BackLink } from "@/components/layout/back-link";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { DeadLetterRecords } from "@/components/system/dead-letter-records";
import { ReplayPending } from "@/components/system/replay-pending";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { getDeadLetters } from "@/lib/api/dead-letters";
import { getAdminHandles } from "@/lib/api/names";
import { referenceNow } from "@/lib/api/shared";
import type { DeadLetterRecordsResponse } from "@/lib/api/types";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One dead-letter topic: what is on it, and the replay `make dlt-replay` does by hand — the only
 * way to do it on production, where the broker wants a password the CLI does not have.
 */
export default async function DeadLettersPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  if (!topic) redirect("/system/queues");

  let data: DeadLetterRecordsResponse;
  try {
    data = await getDeadLetters(topic);
  } catch (error) {
    return (
      <>
        <BackLink href="/system/queues">Queues &amp; DLQ</BackLink>
        <PageHeader title={topic} />
        <ErrorState error={error} />
      </>
    );
  }

  const now = referenceNow();
  // Non-fatal: a row without a handle keeps showing the id.
  const handles = await getAdminHandles(data.records.map((record) => record.lastReplay?.adminId ?? null));
  const { topic: summary } = data;

  return (
    <>
      <BackLink href="/system/queues">Queues &amp; DLQ</BackLink>
      <PageHeader
        title={summary.originTopic}
        subtitle="Records a consumer of this topic gave up on, and the replay that sends them back to it."
      />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader
            title={summary.topic}
            hint="Pending counts what no replay of every pending record has been past yet — from here or from make dlt-replay ALL=1, which share their place on the topic. A replayed record stays on the topic until retention drops it."
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[13px] xl:grid-cols-4">
            <Field label="Pending">
              <span className={cn("figure", summary.pending > 0 && "text-danger")}>
                {formatNumber(summary.pending)}
              </span>
            </Field>
            <Field label="Held by Kafka">
              <span className="figure">{formatNumber(summary.retained)}</span>
              <span className="text-ink-faint"> until retention drops them</span>
            </Field>
            <Field label="Last parked">
              {summary.latestAt ? (
                <span title={formatDateTime(summary.latestAt)}>{relativeTime(summary.latestAt, now)}</span>
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </Field>
            <Field label="Goes back to">{summary.originTopic}</Field>
          </dl>
          <ReplayPending topic={summary.topic} originTopic={summary.originTopic} pending={summary.pending} />
        </Card>

        <DeadLetterRecords
          topic={summary.topic}
          originTopic={summary.originTopic}
          records={data.records}
          handles={handles}
          now={now}
        />
      </div>
    </>
  );
}
