import "server-only";

import { apiDelete, apiGet, apiPost } from "./client";
import { USE_MOCK } from "./config";
import { LIST_PAGE_SIZE, mockPage } from "./shared";
import type {
  AddModerationTermRequest,
  ModerationTermAction,
  ModerationTermResponse,
  ModerationTermSummaryResponse,
  Page,
  TextPreviewResponse,
  TextSurface,
} from "./types";
import { mockModerationTermSummary, mockModerationTerms } from "@/lib/mock/terms";

/*
 * The console's word list, kept by admin-service: terms added on top of the list every service
 * ships with, or taken out of it. Every service that screens text polls it and rebuilds its matcher
 * within a minute — no deploy, no event. A change is not a decision against anyone, so it is not in
 * the audit log; the list itself, with who added each term, is the record.
 */

/** Live terms, newest first — admin-service orders them so whatever is asked. */
export async function listModerationTerms(options: {
  /** Anywhere in the term, case-insensitively. */
  q?: string;
  action?: ModerationTermAction;
  page?: number;
  size?: number;
} = {}): Promise<Page<ModerationTermResponse>> {
  const { q, action, page = 0, size = LIST_PAGE_SIZE } = options;

  if (USE_MOCK) {
    const needle = q?.toLowerCase();
    const matches = mockModerationTerms.filter(
      (term) =>
        (!action || term.action === action) && (!needle || term.term.toLowerCase().includes(needle)),
    );
    return mockPage(matches, page, size);
  }

  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (action) params.set("action", action);
  return apiGet<Page<ModerationTermResponse>>(`/api/v1/admin/moderation/terms?${params}`);
}

/** What the list is made of: the shipped file's version and size, and the admin revision on top. */
export async function getModerationTermSummary(): Promise<ModerationTermSummaryResponse> {
  if (USE_MOCK) return mockModerationTermSummary;
  return apiGet<ModerationTermSummaryResponse>("/api/v1/admin/moderation/terms/summary");
}

/** 409 MODERATION_TERM_EXISTS when a live term keys the same; 400 INVALID_MODERATION_TERM when no service could use it as asked. */
export async function addModerationTerm(
  request: AddModerationTermRequest,
): Promise<ModerationTermResponse> {
  if (USE_MOCK) {
    throw new Error(
      "Adding a term requires the live backend (ADMIN_USE_MOCK=false) — the list lives in admin-service, and every service polls it from there.",
    );
  }
  return apiPost<ModerationTermResponse>("/api/v1/admin/moderation/terms", request);
}

/** A soft delete. 404 MODERATION_TERM_NOT_FOUND when it is already gone. */
export async function removeModerationTerm(termId: string): Promise<void> {
  if (USE_MOCK) {
    throw new Error(
      "Removing a term requires the live backend (ADMIN_USE_MOCK=false) — the list lives in admin-service, and every service polls it from there.",
    );
  }
  await apiDelete<null>(`/api/v1/admin/moderation/terms/${termId}`);
}

/**
 * What screening makes of a text right now: the rules and the classifier, run by admin-service
 * the way the services would. It brings itself up to the list's revision first, so a term added a
 * second ago is already in it.
 */
export async function previewText(text: string, surface: TextSurface): Promise<TextPreviewResponse> {
  if (USE_MOCK) {
    throw new Error(
      "The preview requires the live backend (ADMIN_USE_MOCK=false) — it runs the services' own word list and classifier.",
    );
  }
  return apiPost<TextPreviewResponse>("/api/v1/admin/moderation/text-preview", { text, surface });
}
