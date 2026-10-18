import "server-only";

import { apiGet } from "./client";
import { USE_MOCK } from "./config";
import type { DataExportSummaryResponse } from "./types";
import { mockDataExportSummary } from "@/lib/mock/data-exports";

/*
 * "Download your data", kept by user-service: an owner asks for an archive, a background worker
 * builds it into MinIO. The console only watches — a request that keeps failing is otherwise a
 * log line its owner sees as "Failed".
 */

export async function getDataExportSummary(): Promise<DataExportSummaryResponse> {
  if (USE_MOCK) return mockDataExportSummary;
  return apiGet<DataExportSummaryResponse>("/api/v1/users/admin/data-exports/summary");
}
