"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api/client";
import { addModerationTerm, previewText, removeModerationTerm } from "@/lib/api/terms";
import type {
  ModerationTermAction,
  TextCategory,
  TextPreviewResponse,
  TextSurface,
} from "@/lib/api/types";
import type { ModerationResult } from "@/lib/moderation";
import { previewProblem, termErrorMessage, termProblem } from "@/lib/moderation-terms";

export type PreviewResult =
  | { ok: true; preview: TextPreviewResponse }
  | { ok: false; message: string };

function failure(error: unknown): { code: string | null; message: string } {
  return {
    code: error instanceof ApiError ? error.code : null,
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Live in admin-service's own preview at once, and in every service within a minute, when they
 * next poll. Nothing to wait for on this page, unlike a ban: the list is admin-service's own table.
 */
export async function addTermAction(input: {
  term: string;
  action: ModerationTermAction;
  category: TextCategory | null;
  note: string;
}): Promise<ModerationResult> {
  const problem = termProblem(input);
  if (problem) return { ok: false, message: problem };

  const term = input.term.trim();
  try {
    await addModerationTerm({
      term,
      action: input.action,
      category: input.action === "EXEMPT" ? null : input.category,
      note: input.note.trim() || null,
    });
  } catch (error) {
    const { code, message } = failure(error);
    return { ok: false, message: termErrorMessage(code, message) };
  }

  revalidatePath("/moderation/terms");
  const effect =
    input.action === "EXEMPT"
      ? "exempted: the shipped term stops matching"
      : `added: a match is ${input.action === "REJECT" ? "refused" : "held for a person"}`;
  return {
    ok: true,
    message: `"${term}" ${effect}. The preview uses it now; every service within a minute.`,
  };
}

/**
 * A term already gone counts as removed: what the admin asked for is the state the list is in, and
 * the page is re-read either way, so the row disappears instead of offering the same failure again.
 */
export async function removeTermAction(
  termId: string,
  term: string,
  action: ModerationTermAction,
): Promise<ModerationResult> {
  try {
    await removeModerationTerm(termId);
  } catch (error) {
    const { code, message } = failure(error);
    if (code === "MODERATION_TERM_NOT_FOUND") {
      revalidatePath("/moderation/terms");
      return { ok: true, message: termErrorMessage(code, message) };
    }
    return { ok: false, message: termErrorMessage(code, message) };
  }

  revalidatePath("/moderation/terms");
  return {
    ok: true,
    message:
      action === "EXEMPT"
        ? `"${term}" is no longer exempt: the shipped term matches again within a minute.`
        : `"${term}" removed: it stops matching within a minute.`,
  };
}

export async function previewTextAction(text: string, surface: TextSurface): Promise<PreviewResult> {
  const problem = previewProblem(text);
  if (problem) return { ok: false, message: problem };
  try {
    return { ok: true, preview: await previewText(text, surface) };
  } catch (error) {
    return { ok: false, message: failure(error).message };
  }
}
