"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { AdminVideoResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * The batch as a row of poster frames: where the moderator is, what they have answered, and any
 * video they can jump to. Answered ones fade and carry their answer.
 */
export function QueueStrip({
  videos,
  current,
  answers,
  remaining,
  onPick,
  onStep,
}: {
  videos: AdminVideoResponse[];
  /** Index of the video on screen, -1 once the batch is done. */
  current: number;
  answers: ReadonlyMap<string, { answer: "approve" | "reject" }>;
  /** Videos in the batch still without an answer. */
  remaining: number;
  onPick: (videoId: string) => void;
  onStep: (delta: 1 | -1) => void;
}) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  return (
    <Card className="flex items-center gap-2 px-3 py-2">
      <StepButton
        label="Previous video (K)"
        disabled={current <= 0}
        onClick={() => onStep(-1)}
        Icon={ChevronLeft}
      />
      <ol ref={list} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1.5">
        {videos.map((video, i) => {
          const answer = answers.get(video.id)?.answer;
          const AnswerIcon = answer === "approve" ? CheckCircle2 : XCircle;
          return (
            <li key={video.id} className="shrink-0">
              <button
                type="button"
                aria-current={i === current}
                aria-label={`${i + 1}. ${video.title || "(untitled upload)"}${answer ? ` — ${answer === "approve" ? "approved" : "rejected"}` : ""}`}
                title={video.title || "(untitled upload)"}
                onClick={() => onPick(video.id)}
                className={cn(
                  "relative block rounded-md p-0.5 transition-opacity",
                  i === current ? "ring-2 ring-accent" : "hover:opacity-80",
                  answer && i !== current && "opacity-45",
                )}
              >
                <VideoThumb src={video.thumbnailUrl} className="h-12 w-8" />
                {answer ? (
                  <span className="absolute -right-1 -bottom-1 rounded-full bg-surface">
                    <AnswerIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        answer === "approve" ? "text-success" : "text-danger",
                      )}
                    />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      <StepButton
        label="Next video (J)"
        disabled={current < 0 || current >= videos.length - 1}
        onClick={() => onStep(1)}
        Icon={ChevronRight}
      />
      <p className="hidden shrink-0 pr-1 text-[12px] text-ink-soft sm:block">
        {current >= 0 ? (
          <>
            <span className="figure font-medium text-ink">{current + 1}</span> of{" "}
            {videos.length} ·{" "}
          </>
        ) : null}
        {remaining} to answer
      </p>
    </Card>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  Icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  Icon: typeof ChevronLeft;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
