import { Card, CardHeader } from "@/components/ui/card";
import type { TextModerationStatusResponse } from "@/lib/api/types";
import {
  classifierEnforcement,
  listsDiffer,
  rulesEnforcement,
  textModerationHealth,
} from "@/lib/system-status";
import { ToneBadge } from "./tone-badge";

/**
 * TEXT_MODERATION_ENFORCE and TEXT_CLASSIFIER_ENFORCE as each service that screens text is running
 * with them. Switched off, a verdict is still recorded on the comment or the video, and nothing is
 * held or refused — which from anywhere else looks exactly like nothing being found.
 */
export function TextModerationStatus({ statuses }: { statuses: TextModerationStatusResponse[] }) {
  const health = textModerationHealth(statuses);

  return (
    <Card>
      <CardHeader
        title="Text moderation in force"
        hint="Reported by each service itself, so it is what that service is deciding with right now. Changing either switch means redeploying that service with TEXT_MODERATION_ENFORCE or TEXT_CLASSIFIER_ENFORCE set."
        actions={<ToneBadge tone={health.tone}>{health.text}</ToneBadge>}
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px] xl:min-w-[640px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Service</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Word list &amp; spam rules</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Classifier</th>
              <th className="label-caps px-5 py-3 text-ink-soft">List in use</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => {
              const rules = rulesEnforcement(status);
              const classifier = classifierEnforcement(status);
              return (
                <tr key={status.service} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-3 font-medium">{status.service}</td>
                  <td className="px-3 py-3">
                    <ToneBadge tone={rules.tone}>{rules.label}</ToneBadge>
                  </td>
                  <td className="px-3 py-3">
                    <ToneBadge tone={classifier.tone}>{classifier.label}</ToneBadge>
                  </td>
                  <td className="figure px-5 py-3 break-all text-ink-soft">
                    {status.version ?? <span className="text-ink-faint">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-5 py-3 text-[11px] text-ink-faint">
        Recording only: every verdict is still computed, logged and kept on the comment or video, and
        nothing is held or refused — for measuring false positives before switching it on. Not reported:
        a build from before services reported it.
        {listsDiffer(statuses)
          ? " The services are on different lists: admin terms reach each within a minute, so a gap that lasts longer is a service that stopped polling admin-service."
          : null}
      </p>
    </Card>
  );
}
