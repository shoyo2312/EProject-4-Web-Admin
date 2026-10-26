import { TextFlags } from "@/components/moderation/text-flags";
import { Field } from "@/components/ui/row-detail";
import type { TextModerationSummary } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { MODERATION_VERDICT_LABELS } from "@/lib/labels";
import { parseTextFlag } from "@/lib/text-flags";

/**
 * What text moderation made of a video's title, description and tags at publish: every flag,
 * classifier notes included, and which rules decided. The only explanation a video whose frames
 * passed has for waiting in review.
 */
export function CaptionCheck({ check }: { check: TextModerationSummary | null }) {
  if (!check) {
    return (
      <p className="text-[13px] text-ink-faint">
        Not screened — the upload predates text moderation.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] xl:grid-cols-4">
        <Field label="Verdict">{MODERATION_VERDICT_LABELS[check.verdict]}</Field>
        {/* Off while the rules only measure: the verdict was recorded and held nothing. */}
        <Field label="Acted on">{check.enforced ? "Yes" : "No — measured only"}</Field>
        <Field label="Checked">{formatDateTime(check.checkedAt)}</Field>
        <Field label="Rules">
          <span className="figure break-all">{check.version}</span>
        </Field>
      </dl>
      {check.flags.length > 0 ? (
        <TextFlags flags={check.flags.map(parseTextFlag)} />
      ) : (
        <p className="text-[13px] text-ink-faint">Nothing in the caption was flagged.</p>
      )}
    </div>
  );
}
