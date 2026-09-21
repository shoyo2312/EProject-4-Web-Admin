import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { getModerationSettings } from "@/lib/api/admin";
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
        subtitle="What automatic moderation is deciding with. Read-only — these live in the classifier's own environment."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Automatic moderation"
            hint="GET /api/v1/admin/settings/moderation — admin-service reading moderation-service's /config"
          />
          {moderation.reachable ? (
            <Thresholds values={moderation.values} />
          ) : (
            <p className="px-5 py-8 text-center text-[12px] text-ink-faint">
              moderation-service did not answer. Nothing is broken on this screen — uploads are
              still being screened by whatever that container was started with; this is only the
              page that reads it back.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Not configurable from here yet" />
          <ul className="list-disc space-y-1.5 py-4 pr-5 pl-10 text-[12px] text-ink-soft">
            <li>
              Admin accounts — auth-service has one ROLE_ADMIN and no endpoint to grant or revoke
              it.
            </li>
            <li>
              Forcing an admin&apos;s sessions to end (auth:blacklist:user:&#123;userId&#125; is
              written by the ban path only).
            </li>
            <li>Audit retention: fixed at admin-service&apos;s nightly cron.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

/**
 * The thresholds, named rather than dumped as JSON, and in the order a verdict applies them:
 * under `reviewAt` nothing happens, above `rejectAt` with enough frames agreeing the upload is
 * rejected outright, and the band between them is what escalation exists for.
 */
function Thresholds({ values }: { values: ModerationSettingsResponse["values"] }) {
  const escalating = values.escalationEnabled === true;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[12px] xl:grid-cols-4">
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

function show(value: unknown): string {
  return value === null || value === undefined ? "—" : String(value);
}
