import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function SystemQueuesPage() {
  return (
    <NotBuiltYet
      title="Queues & DLQ"
      purpose="Kafka consumer health, dead-letter backlog and outbox lag."
      missing={[
        "Nothing reads the dead-letter topics back: consumers built on kafka-lib already park failed messages in <topic>.DLT, but no endpoint (or admin-service consumer) exposes them",
        "Outbox lag metric: count of rows with published_at IS NULL per service",
      ]}
    />
  );
}
