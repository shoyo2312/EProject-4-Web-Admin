import { Card, CardHeader } from "@/components/ui/card";
import type { OutboxBacklogResponse } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { formatWait, outboxHealth, outboxState } from "@/lib/system-status";
import { cn } from "@/lib/utils";
import { ToneBadge } from "./tone-badge";

const COLUMNS = 5;

/**
 * Events each service has committed but Kafka has not acknowledged yet. A stuck outbox is
 * silent everywhere else: the change is saved, the event that tells every other service about it
 * is not sent, and nothing fails.
 */
export function OutboxCard({ services }: { services: OutboxBacklogResponse[] }) {
  const health = outboxHealth(services);

  return (
    <Card>
      <CardHeader
        title="Outboxes"
        hint="Events saved with the change that caused them, waiting for Kafka to acknowledge them. Read each time from the service's own database. Stuck means the oldest has waited past 5 minutes — the same line the OutboxStuck alert uses — usually Kafka down, or the service's poller stopped."
        actions={<ToneBadge tone={health.tone}>{health.text}</ToneBadge>}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[640px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Service</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Outbox</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Pending</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Oldest waiting</th>
              <th className="label-caps px-5 py-3 text-ink-soft">State</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) =>
              !service.reachable || service.outboxes.length === 0 ? (
                <tr key={service.service} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3 font-medium">{service.service}</td>
                  <td colSpan={COLUMNS - 1} className="px-3 py-3 text-ink-faint">
                    {service.reachable
                      ? "Reports no outbox gauges — a build from before them."
                      : "Its actuator did not answer, so the backlog is unknown."}
                  </td>
                </tr>
              ) : (
                service.outboxes.map((outbox, index) => {
                  const state = outboxState(outbox);
                  return (
                    <tr key={`${service.service}:${outbox.name}`} className="border-b border-line last:border-b-0">
                      <td className="px-5 py-3 font-medium">{index === 0 ? service.service : null}</td>
                      <td className="px-3 py-3 text-ink-soft">{outbox.name}</td>
                      <td className="figure px-3 py-3">
                        {outbox.pending === null ? <span className="text-ink-faint">—</span> : formatNumber(outbox.pending)}
                      </td>
                      <td className={cn("figure px-3 py-3", state.tone === "bad" && "text-danger")}>
                        {formatWait(outbox.oldestPendingAgeSeconds)}
                      </td>
                      <td className="px-5 py-3">
                        <ToneBadge
                          tone={state.tone}
                          title={state.label === "Cannot count" ? "Its own database did not answer the count." : undefined}
                        >
                          {state.label}
                        </ToneBadge>
                      </td>
                    </tr>
                  );
                })
              ),
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
