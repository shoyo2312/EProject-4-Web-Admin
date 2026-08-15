import { NotBuiltYet } from "@/components/layout/not-built-yet";

export default function OrdersPage() {
  return (
    <NotBuiltYet
      title="Orders"
      purpose="Track order sagas end to end and unstick failed ones."
      missing={[
        "order-service: GET /api/v1/orders is scoped to the caller (listMine) — needs an admin-wide list",
        "Saga state exposure: which step an order is stuck on, and a manual retry/compensate trigger",
        "payment-service: same, GET /api/v1/payments is listMine only",
        "order-service and payment-service both need the kafka-lib OutboxDispatcher migration",
      ]}
    />
  );
}
