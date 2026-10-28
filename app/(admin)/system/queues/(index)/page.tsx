import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { DataExportCard } from "@/components/system/data-export-card";
import { DeadLetterTopicsCard } from "@/components/system/dead-letter-topics-card";
import { OutboxCard } from "@/components/system/outbox-card";
import { listDeadLetterTopics } from "@/lib/api/dead-letters";
import { getDataExportSummary } from "@/lib/api/data-exports";
import { getHandles } from "@/lib/api/names";
import { referenceNow } from "@/lib/api/shared";
import { getOutboxBacklogs } from "@/lib/api/system";

/** Each card fails on its own: Kafka down says nothing about whether user-service's exports move. */
export default async function SystemQueuesPage() {
  return (
    <>
      <PageHeader
        title="Queues & DLQ"
        subtitle="Background work across the services: what is waiting, stuck or given up on."
      />

      <div className="stagger space-y-4">
        <DeadLetters />
        <Outboxes />
        <DataExports />
      </div>
    </>
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

async function Outboxes() {
  let services;
  try {
    services = await getOutboxBacklogs();
  } catch (error) {
    return <ErrorState error={error} />;
  }
  return <OutboxCard services={services} />;
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
