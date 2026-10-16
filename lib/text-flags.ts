import type { CaptionField } from "@/lib/api/types";
import { CAPTION_FIELD_LABELS, categoryLabel } from "@/lib/labels";

/**
 * One flag text moderation raised, as the services store it: `CATEGORY:rule` — `SPAM:link:bit.ly`,
 * `HATE:model:HATE:0.93` — and on a caption the field first, `DESCRIPTION:SPAM:link:bit.ly`. The
 * string carries no severity, so a classifier's note reads like a hold; on a comment, its status
 * says which it came to.
 */
export interface TextFlag {
  /** Where in a caption it was found; null on a comment. */
  field: CaptionField | null;
  category: string;
  /** What fired, as the service wrote it: `term:<term>`, `link:<domain>`, `phone`, `model:<label>:<score>`… */
  rule: string;
}

const FIELDS: ReadonlySet<string> = new Set<CaptionField>(["TITLE", "DESCRIPTION", "TAGS"]);

export function parseTextFlag(flag: string): TextFlag {
  const [first = "", ...rest] = flag.split(":");
  const field = FIELDS.has(first) ? (first as CaptionField) : null;
  const [category = "", ...rule] = field ? rest : [first, ...rest];
  return { field, category, rule: rule.join(":") };
}

/** A comment's moderationReason: every flag on one line, "; " between them. */
export function reasonFlags(reason: string | null): TextFlag[] {
  return reason ? reason.split("; ").filter(Boolean).map(parseTextFlag) : [];
}

/** One flag as a line of text — "Description · Spam: link:bit.ly" — for a tooltip or a list. */
export function flagText(flag: TextFlag): string {
  const where = flag.field ? `${CAPTION_FIELD_LABELS[flag.field]} · ` : "";
  return `${where}${categoryLabel(flag.category)}${flag.rule ? `: ${flag.rule}` : ""}`;
}
