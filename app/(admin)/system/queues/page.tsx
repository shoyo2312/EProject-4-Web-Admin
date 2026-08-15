import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function SystemQueuesPage() {
  return (
    <NotBuiltYet
      title="Queues & DLQ"
      purpose="Kafka consumer health, dead-letter backlog and outbox lag."
      missing={[
        "No service exposes DLQ contents — needs an endpoint (or admin-service consumer) reading <topic>.DLT",
        "Outbox lag metric: count of rows with published_at IS NULL per service",
        "8 services still run the default infinite-retry error handler (analytics, inventory, media-worker, notification, order, payment, recommendation, search) — migrate to kafka-lib first, otherwise there is no DLQ to show",
      ]}
    />
  );
}
