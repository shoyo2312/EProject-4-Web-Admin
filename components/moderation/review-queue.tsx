"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Inbox, XCircle } from "lucide-react";
import {
  reviewContextAction,
  type ReviewContext,
} from "@/app/(admin)/moderation/review/actions";
import { moderateVideoAction } from "@/app/(admin)/videos/actions";
import { CaptionCheck } from "@/components/moderation/caption-check";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ReasonForm } from "@/components/moderation/reason-form";
import { ClassifierPanel } from "@/components/moderation/review-queue/classifier-panel";
import { QueueStrip } from "@/components/moderation/review-queue/queue-strip";
import { UploaderPanel } from "@/components/moderation/review-queue/uploader-panel";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import { VideoStatusBadge } from "@/components/ui/status-badge";
import type { AdminVideoResponse } from "@/lib/api/types";
import { formatDuration, formatNumber, plural, relativeTime } from "@/lib/format";
import { isTypingTarget } from "@/lib/keyboard";
import { PRESET_REASONS } from "@/lib/moderation";
import { nextUndecided, reviewCommand, type ReviewLines } from "@/lib/review";
import { cn } from "@/lib/utils";

type Answer = "approve" | "reject";

interface Decision {
  answer: Answer;
  reason: string;
}

/** A video's context: absent until asked for, then in flight, loaded, or failed. */
type Loaded = ReviewContext | "loading" | "failed";

const ANSWERS = {
  approve: {
    label: "Approve",
    key: "A",
    confirm: "Confirm approval",
    done: "Approved",
    Icon: CheckCircle2,
    tone: "text-success",
  },
  reject: {
    label: "Reject",
    key: "R",
    confirm: "Confirm rejection",
    done: "Rejected",
    Icon: XCircle,
    tone: "text-danger",
  },
} as const;

/**
 * One held video at a time: the player beside why the classifier held it and who uploaded it,
 * answered with A or R and a reason. A decision moves straight on to the next video still waiting.
 * The answer stays marked on the one decided, because video-service applies it a few seconds later
 * and until then a reload still lists it as waiting.
 */
export function ReviewQueue({
  startAt,
  videos,
  total,
  handles,
  lines,
}: {
  /** The video to open on. One not in the batch, or none, opens on the oldest still waiting. */
  startAt: string | null;
  /** The batch, oldest upload first. */
  videos: AdminVideoResponse[];
  /** Every held video when the page loaded, the batch included. */
  total: number;
  /** userId → @handle for the batch's uploaders, shown until a video's own record arrives. */
  handles: Record<string, string>;
  lines: ReviewLines | null;
}) {
  const router = useRouter();
  const [currentId, setCurrentId] = useState<string | null>(startAt);
  const [decided, setDecided] = useState<ReadonlyMap<string, Decision>>(() => new Map());
  const [contexts, setContexts] = useState<Record<string, Loaded>>({});
  const [open, setOpen] = useState<Answer | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [reloading, startReload] = useTransition();
  const [muted, setMuted] = useState(true);

  const ids = videos.map((video) => video.id);
  const decidedIds = new Set(decided.keys());
  const remaining = ids.filter((id) => !decidedIds.has(id)).length;
  // Opens on the first video still waiting, and goes back to it when a reload brings a batch the
  // video on screen is no longer in.
  const index =
    currentId !== null && ids.includes(currentId)
      ? ids.indexOf(currentId)
      : nextUndecided(ids, decidedIds, -1);
  const listed = index >= 0 ? videos[index] : null;
  const loaded = listed ? contexts[listed.id] : undefined;
  const context = typeof loaded === "object" ? loaded : null;
  const fresh = context?.video ?? null;
  const video = fresh ?? listed;
  const answered = listed ? decided.get(listed.id) : undefined;
  const AnsweredIcon = answered ? ANSWERS[answered.answer].Icon : null;
  // Decided some other way since the batch loaded: by another moderator, or deleted by its owner.
  const gone = context !== null && context.video === null;
  const settled = fresh !== null && (fresh.status !== "PENDING_REVIEW" || fresh.deletedAt !== null);
  const canDecide = listed !== null && !answered && !gone && !settled;
  // Shown when there is something to say, and when part of it could not be read — hiding the card
  // then would read as a video nobody has decided on or reported.
  const showEarlier =
    context !== null
    && (context.history === null || context.history.length > 0 || context.reportCount !== 0);

  useEffect(() => {
    if (!listed || contexts[listed.id] !== undefined) return;
    const { id, userId } = listed;
    // A beat before asking, so holding J through the queue loads the video it stops on rather than
    // each one it passes: a context is ten reads against the gateway's per-address rate limit.
    const timer = window.setTimeout(() => {
      setContexts((all) => ({ ...all, [id]: "loading" }));
      reviewContextAction(id, userId).then(
        (result) => setContexts((all) => ({ ...all, [id]: result })),
        () => setContexts((all) => ({ ...all, [id]: "failed" })),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, [listed, contexts]);

  function go(videoId: string | null) {
    setCurrentId(videoId);
    setOpen(null);
    setReason("");
  }

  function step(delta: 1 | -1) {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ids.length) return;
    go(ids[target]);
  }

  function start(answer: Answer) {
    setOpen(answer);
    setReason("");
  }

  function retry(videoId: string) {
    setContexts((all) => {
      const rest = { ...all };
      delete rest[videoId];
      return rest;
    });
  }

  function submit() {
    if (!listed || !open) return;
    const target = listed;
    const answer = open;
    const why = reason.trim();
    startSubmit(async () => {
      const outcome = await moderateVideoAction(target.id, answer, why);
      if (!outcome.ok) {
        setNotice({ ok: false, text: outcome.message });
        return;
      }
      const next = new Map(decided).set(target.id, { answer, reason: why });
      setDecided(next);
      setNotice({
        ok: true,
        text: `${ANSWERS[answer].done} “${target.title || "(untitled upload)"}”. ${outcome.message}`,
      });
      const after = nextUndecided(ids, new Set(next.keys()), ids.indexOf(target.id));
      go(after >= 0 ? ids[after] : null);
    });
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      setOpen(null);
      return;
    }
    const command = reviewCommand(
      event.key,
      event.metaKey || event.ctrlKey || event.altKey,
      isTypingTarget(event.target),
    );
    if (!command || event.defaultPrevented) return;
    event.preventDefault();
    if (command === "next") step(1);
    else if (command === "previous") step(-1);
    else if (canDecide && !submitting) start(command);
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (videos.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-5 py-14 text-center">
        <Inbox className="h-5 w-5 text-ink-faint" />
        <p className="text-[13px] text-ink-soft">The queue is empty.</p>
        <p className="max-w-sm text-[12px] text-ink-faint">
          Videos automatic moderation holds back for a person land here, longest waiting first.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <QueueStrip
        videos={videos}
        current={index}
        answers={decided}
        remaining={remaining}
        onPick={go}
        onStep={step}
      />

      {notice ? (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-4 py-2.5 text-[13px]",
            notice.ok
              ? "border-success/25 bg-success-bg text-success"
              : "border-danger/25 bg-danger-bg text-danger",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      {listed && video ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <Player key={listed.id} listed={listed} fresh={fresh} muted={muted} onMuted={setMuted} />
          </Card>

          <div className="min-w-0 space-y-4">
            <Card>
              <div className="space-y-3 px-5 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[15px] leading-snug font-semibold wrap-anywhere">
                    {video.title || "(untitled upload)"}
                  </h2>
                  <Link
                    href={`/videos/${video.id}` as never}
                    className="shrink-0 text-[12px] text-ink-soft underline-offset-4 hover:underline"
                  >
                    Full page →
                  </Link>
                </div>
                <dl className="grid grid-cols-3 gap-x-4 text-[13px]">
                  <Field label="Uploaded">{relativeTime(video.createdAt)}</Field>
                  <Field label="Duration">
                    {video.durationSeconds != null ? formatDuration(video.durationSeconds) : "—"}
                  </Field>
                  <Field label="Visibility">{video.visibility}</Field>
                </dl>
                {video.description ? (
                  <p className="text-[13px] text-ink-soft wrap-anywhere">{video.description}</p>
                ) : null}
                {video.tags.length > 0 ? (
                  <p className="text-[12px] text-ink-faint wrap-anywhere">
                    {video.tags.map((tag) => `#${tag}`).join(" ")}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-line px-5 py-4">
                {answered ? (
                  <p className={cn("flex items-start gap-2 text-[13px]", ANSWERS[answered.answer].tone)}>
                    {AnsweredIcon ? <AnsweredIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                    <span>
                      You {answered.answer === "approve" ? "approved" : "rejected"} this video: “
                      {answered.reason}”. Video-service applies it within seconds.
                    </span>
                  </p>
                ) : gone ? (
                  <p className="text-[13px] text-ink-faint">
                    This video no longer exists — there is nothing left to decide.
                  </p>
                ) : fresh?.deletedAt ? (
                  <p className="text-[13px] text-ink-faint">
                    Its owner deleted it while it waited — there is nothing left to decide.
                  </p>
                ) : settled && fresh ? (
                  <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
                    Already decided — it is now <VideoStatusBadge status={fresh.status} dense />
                  </p>
                ) : open ? (
                  <ReasonForm
                    presets={PRESET_REASONS[open]}
                    reason={reason}
                    onReason={setReason}
                    onSubmit={submit}
                    onCancel={() => setOpen(null)}
                    submitting={submitting}
                    placeholder={`Reason to ${open} “${video.title || video.id}”`}
                    confirmLabel={ANSWERS[open].confirm}
                    submitOnEnter
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(["approve", "reject"] as const).map((answer) => {
                      const { label, key, Icon, tone } = ANSWERS[answer];
                      return (
                        <button
                          key={answer}
                          type="button"
                          disabled={submitting}
                          onClick={() => start(answer)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-[13px] font-medium transition-colors hover:bg-canvas disabled:opacity-40",
                            tone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                          <Kbd>{key}</Kbd>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                  <span>
                    <Kbd>J</Kbd> next
                  </span>
                  <span>
                    <Kbd>K</Kbd> previous
                  </span>
                  <span>
                    <Kbd>A</Kbd> approve
                  </span>
                  <span>
                    <Kbd>R</Kbd> reject
                  </span>
                  <span>
                    <Kbd>Enter</Kbd> confirm
                  </span>
                  <span>
                    <Kbd>Esc</Kbd> cancel
                  </span>
                </p>
              </div>
            </Card>

            <ClassifierPanel moderation={video.moderation} lines={lines} />

            {video.textModeration?.flags.length ? (
              <Card>
                <CardHeader
                  title="Caption check"
                  hint="What text moderation flagged in the title, description and tags, classifier notes included."
                />
                <div className="px-5 py-4">
                  <CaptionCheck check={video.textModeration} />
                </div>
              </Card>
            ) : null}

            <UploaderPanel
              ownerId={video.userId}
              handle={handles[video.userId]}
              record={context?.uploader ?? null}
              failed={loaded === "failed"}
              onRetry={() => retry(listed.id)}
            />

            {context && showEarlier ? (
              <Card>
                <CardHeader title="Earlier on this video" />
                <div className="px-5 py-4">
                  <ModerationHistory
                    reportCount={context.reportCount}
                    actions={context.history}
                    handles={context.handles}
                    loading={false}
                  />
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-[13px] text-ink-soft">
            Every video in this batch has an answer —{" "}
            {formatNumber(decided.size)} {plural(decided.size, "decision")} this visit.
          </p>
          <p className="max-w-md text-[12px] text-ink-faint">
            {total > videos.length
              ? `${formatNumber(total - videos.length)} more ${plural(total - videos.length, "was", "were")} waiting when the page loaded.`
              : "That was everything waiting when the page loaded."}{" "}
            Decisions take a few seconds to apply, so one just made can still come back once.
          </p>
          <button
            type="button"
            disabled={reloading}
            onClick={() => startReload(() => router.refresh())}
            className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            {reloading ? "Loading…" : total > videos.length ? "Load the next videos" : "Check for new ones"}
          </button>
        </Card>
      )}
    </div>
  );
}

/**
 * The upload itself, playing as soon as it is on screen — muted, as browsers require of autoplay,
 * until the moderator turns the sound on, which then carries to the next video.
 */
function Player({
  listed,
  fresh,
  muted,
  onMuted,
}: {
  listed: AdminVideoResponse;
  /** The same video re-read just now, once it has been. */
  fresh: AdminVideoResponse | null;
  muted: boolean;
  onMuted: (muted: boolean) => void;
}) {
  // The batch's signed media URLs last fifteen minutes. Past that the file errors, and the copy
  // re-read for this video takes over — not before, since swapping the source restarts playback.
  const [expired, setExpired] = useState(false);
  const source = expired && fresh ? fresh : listed;

  if (!source.hlsUrl || source.purgeEventPublishedAt) {
    return (
      <p className="px-5 py-16 text-center text-[13px] text-ink-faint">
        No playable file on the record — the transcode produced no output.
      </p>
    );
  }

  return (
    <div className="flex justify-center bg-black">
      <video
        src={source.hlsUrl}
        poster={source.thumbnailUrl ?? undefined}
        controls
        autoPlay
        loop
        playsInline
        muted={muted}
        onVolumeChange={(event) => onMuted(event.currentTarget.muted)}
        onError={() => setExpired(true)}
        className="block max-h-[70vh] w-full object-contain"
      />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface-muted px-1 py-px font-mono text-[11px] text-ink-soft">
      {children}
    </kbd>
  );
}
