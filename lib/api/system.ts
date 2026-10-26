import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import type { OutboxBacklogResponse } from "./types";
import { mockOutboxBacklogs } from "@/lib/mock/system";

/*
 * What the services report about themselves on their actuator, gathered by admin-service — the
 * console cannot reach those ports, and should not. A service that does not answer comes back
 * `reachable: false` rather than failing the whole screen.
 */

export async function getOutboxBacklogs(): Promise<OutboxBacklogResponse[]> {
  if (USE_MOCK) return mockOutboxBacklogs;
  return apiGet<OutboxBacklogResponse[]>("/api/v1/admin/system/outboxes");
}
