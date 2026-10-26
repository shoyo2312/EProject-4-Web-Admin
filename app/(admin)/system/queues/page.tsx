import { ErrorState } from "@/components/layout/error-state";
import { NotBuiltYet } from "@/components/layout/not-built-yet";
import { DataExportCard } from "@/components/system/data-export-card";
import { DeadLetterTopicsCard } from "@/components/system/dead-letter-topics-card";
import { listDeadLetterTopics } from "@/lib/api/dead-letters";
import { getDataExportSummary } from "@/lib/api/data-exports";
import { getHandles } from "@/lib/api/names";
import { referenceNow } from "@/lib/api/shared";

/** Each card fails on its own: Kafka down says nothing about whether user-service's exports move. */
export default async function SystemQueuesPage() {
  return (
    <NotBuiltYet
      title="Queues & DLQ"
      purpose="Background work across the services: what is waiting, stuck or given up on."
      missing={["Outbox lag metric: count of rows with published_at IS NULL per service"]}
    >
      <div className="space-y-4">
        <DeadLetters />
        <DataExports />
      </div>
    </NotBuiltYet>
  );
}

async function DeadLetters() {
  let topics;
  try {
    topics = await listDeadLetterTopics();
  } catch (error) {
    return <ErrorState error={error} />;
  }
  return <DeadLetterTopicsCard topics={topics} now={referenceNow()} />;
}

async function DataExports() {
  let summary;
  try {
    summary = await getDataExportSummary();
  } catch (error) {
    return <ErrorState error={error} />;
  }
  // Non-fatal: a row without a handle keeps showing the id.
  const handles = await getHandles(summary.recentFailures.map((failure) => failure.userId));

  return <DataExportCard summary={summary} handles={handles} now={referenceNow()} />;
}
