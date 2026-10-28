import Link from "next/link";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { TextModerationStatus } from "@/components/system/text-moderation-status";
import { getModerationSettings } from "@/lib/api/moderation";
import { getTextModerationStatus } from "@/lib/api/system";
import type { ModerationSettingsResponse } from "@/lib/api/types";

/**
 * What the platform is currently configured to do, read from the services that own it.
 *
 * Read-only, and not as a first step towards editing: every value here comes from an environment
 * variable that moderation-service reads once at startup, so a form that wrote one would either
 * be forgotten on the next restart or leave the variable saying something else. Changing a
 * threshold is a deploy; what was missing was any way to see which one is in force.
 */
export default async function SettingsPage() {
  let moderation: ModerationSettingsResponse;
  try {
    moderation = await getModerationSettings();
  } catch (error) {
    return (
      <>
        <PageHeader title="Settings" />
        <ErrorState error={error} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="What automatic moderation is deciding with, as each service reports it. Read-only — every value lives in a service's own environment."
      />

      <div className="stagger space-y-4">
        <Card>
          <CardHeader
            title="Automatic moderation"
            hint="Read live from the classifier's own configuration. Changing a value means redeploying that service, not editing it here."
          />
          {moderation.reachable ? (
            <Thresholds values={moderation.values} />
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
              The moderation classifier did not answer. Uploads are still being screened with
              whatever it was started with — only reading the values back failed.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Text classifier"
            hint="The hate-speech model behind the word list, for comments and for captions. Read from the same configuration as the thresholds above, and changed the same way: by redeploying moderation-service."
          />
          {moderation.reachable ? (
            <TextClassifier values={moderation.values} />
          ) : (
            <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
              moderation-service did not answer. Comments and captions are still screened — if
              the classifier cannot be reached, by the word list alone.
            </p>
          )}
        </Card>

        <TextModeration />

        <Card>
          <CardHeader title="Not configurable from here" />
          <ul className="list-disc space-y-1.5 py-4 pr-5 pl-10 text-[13px] text-ink-soft">
            <li>
              Admin accounts — there is a single admin role, granted at startup from{" "}
              <code>ADMIN_EMAIL</code>, and no way to grant or revoke it from the console.
            </li>
            <li>
              The audit log is kept for good: nothing deletes a moderation action. Only the
              outbox rows behind them are swept, a week after Kafka has them.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}

/** Its own failure: the classifier's thresholds above say nothing about whether the services act on text verdicts. */
async function TextModeration() {
  let statuses;
  try {
    statuses = await getTextModerationStatus();
  } catch (error) {
    return <ErrorState error={error} />;
  }
  return <TextModerationStatus statuses={statuses} />;
}

/**
 * The thresholds, named rather than dumped as JSON, and in the order a verdict applies them:
 * under `reviewAt` nothing happens, above `rejectAt` with enough frames agreeing the upload is
 * rejected outright, and the band between them is what escalation exists for.
 */
function Thresholds({ values }: { values: ModerationSettingsResponse["values"] }) {
  const escalating = values.escalationEnabled === true;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[13px] xl:grid-cols-4">
      <Field label="Review at">
        <span className="figure">{show(values.reviewAt)}</span>
        <span className="text-ink-faint"> — a frame at or above this is suspicious</span>
      </Field>
      <Field label="Reject at">
        <span className="figure">{show(values.rejectAt)}</span>
        <span className="text-ink-faint"> — with enough frames agreeing</span>
      </Field>
      <Field label="Frames needed to reject">
        <span className="figure">{show(values.minRejectFrames)}</span>
      </Field>
      <Field label="Frames scored per video">
        <span className="figure">{show(values.maxFrames)}</span>
        <span className="text-ink-faint"> (cap)</span>
      </Field>
      <Field label="Model">{show(values.model)}</Field>
      <Field label="Model version">{show(values.modelVersion)}</Field>
      <Field label="Class acted on">{show(values.nsfwLabel)}</Field>
      {/* The zero-shot scorer. Absent keys are an older moderation-service, not "off". */}
      {values.harmEnabled === true ? (
        <>
          <Field label="Also held for" wide>
            {Array.isArray(values.harmLabels) ? values.harmLabels.join(", ") : "—"}
            <span className="text-ink-faint"> — held for a person, never removed</span>
          </Field>
          <Field label="Their review line">
            <span className="figure">{show(values.harmReviewAt)}</span>
          </Field>
          <Field label="Their model">
            {show(values.harmModel)} · {show(values.harmModelVersion)}
          </Field>
        </>
      ) : null}
      <Field label="Second opinion">
        {escalating ? (
          "Azure Content Safety"
        ) : (
          <span className="text-ink-faint">
            off — the review band is left for a human
          </span>
        )}
      </Field>
      {escalating ? (
        <>
          <Field label="Frames escalated">
            <span className="figure">{show(values.escalationFrames)}</span>
          </Field>
          <Field label="Azure rejects at severity">
            <span className="figure">{show(values.escalationRejectSeverity)}</span>
          </Field>
          <Field label="Azure approves at severity">
            <span className="figure">{show(values.escalationApproveSeverity)}</span>
          </Field>
          <Field label="Categories asked about" wide>
            {Array.isArray(values.escalationCategories)
              ? values.escalationCategories.join(", ")
              : "—"}
          </Field>
        </>
      ) : null}
    </dl>
  );
}

/**
 * The text classifier, from the same /config. A moderation-service older than it reports none of
 * these keys, which is "not known" rather than "off".
 */
function TextClassifier({ values }: { values: ModerationSettingsResponse["values"] }) {
  if (values.textEnabled === undefined) {
    return (
      <p className="px-5 py-8 text-center text-[13px] text-ink-faint">
        This moderation-service does not report a text classifier — it predates one.
      </p>
    );
  }

  return (
    <div className="space-y-3 px-5 py-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] xl:grid-cols-4">
        {values.textEnabled === true ? (
          <>
            <Field label="Holds at">
              <span className="figure">{show(values.textHateHoldAt)}</span>
              <span className="text-ink-faint"> — a hate score this high holds the text; offence alone never does</span>
            </Field>
            <Field label="Texts per request">
              <span className="figure">{show(values.textMaxTexts)}</span>
              <span className="text-ink-faint"> (cap)</span>
            </Field>
            <Field label="Model">{show(values.textModel)}</Field>
            <Field label="Model version">{show(values.textModelVersion)}</Field>
            <Field label="Pinned revision" wide>
              <span className="figure break-all">{show(values.textModelRevision)}</span>
            </Field>
          </>
        ) : (
          <Field label="Status" wide>
            <span className="text-ink-faint">
              off — comments and captions are screened by the word list alone
            </span>
          </Field>
        )}
      </dl>
      <p className="text-[12px] text-ink-faint">
        The word list in front of it is edited under{" "}
        <Link href="/moderation/terms" className="text-ink-soft underline-offset-4 hover:underline">
          Moderation → Terms
        </Link>
        , and is live within a minute.
      </p>
    </div>
  );
}

function show(value: unknown): string {
  return value === null || value === undefined ? "—" : String(value);
}
