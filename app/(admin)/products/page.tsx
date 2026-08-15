import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function ProductsPage() {
  return (
    <NotBuiltYet
      title="Products"
      purpose="Seller catalogue, listing suspension, counterfeit takedowns."
      missing={[
        "product-service: admin list with seller + status filters (GET /api/v1/products is buyer-facing)",
        "product-service: a Kafka consumer for SUSPEND_PRODUCT / REACTIVATE_PRODUCT",
        "product-service still marks outbox rows published before broker ack — migrate to kafka-lib OutboxDispatcher (docs/outbox-migration.md)",
      ]}
    />
  );
}
