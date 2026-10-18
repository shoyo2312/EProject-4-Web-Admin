import { ErrorState } from "@/components/layout/error-state";
import { NotBuiltYet } from "@/components/layout/not-built-yet";
import { DataExportCard } from "@/components/system/data-export-card";
import { getDataExportSummary } from "@/lib/api/data-exports";
import { getHandles } from "@/lib/api/names";
import { referenceNow } from "@/lib/api/shared";

export default async function SystemQueuesPage() {
  return (
    <NotBuiltYet
      title="Queues & DLQ"
      purpose="Background work across the services: what is waiting, stuck or given up on."
      missing={[
        "Nothing reads the dead-letter topics back: consumers built on kafka-lib already park failed messages in <topic>.DLT, but no endpoint (or admin-service consumer) exposes them",
        "Outbox lag metric: count of rows with published_at IS NULL per service",
      ]}
    >
      <DataExports />
    </NotBuiltYet>
  );
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
