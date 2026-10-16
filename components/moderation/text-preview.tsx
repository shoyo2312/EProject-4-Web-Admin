"use client";

import { useState, useTransition } from "react";
import { previewTextAction, type PreviewResult } from "@/app/(admin)/moderation/terms/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { TextDecision, TextPreviewResponse, TextSurface } from "@/lib/api/types";
import {
  FLAG_SOURCE_LABELS,
  TEXT_DECISION_LABELS,
  TEXT_SURFACE_LABELS,
  categoryLabel,
} from "@/lib/labels";
import { flagWeight } from "@/lib/moderation-terms";
import { cn } from "@/lib/utils";

const SURFACES: readonly TextSurface[] = ["COMMENT", "VIDEO_TITLE", "VIDEO_DESCRIPTION", "VIDEO_TAGS"];

const SURFACE_OPTIONS = SURFACES.map((value) => ({ value, label: TEXT_SURFACE_LABELS[value] }));

const PLACEHOLDERS: Record<TextSurface, string> = {
  COMMENT: "A comment, as a viewer would type it…",
  VIDEO_TITLE: "A video's title…",
  VIDEO_DESCRIPTION: "A video's description…",
  // video-service screens a video's tags as one text, joined by spaces.
  VIDEO_TAGS: "A video's tags, separated by spaces…",
};

const DECISION_STYLES: Record<TextDecision, string> = {
  ALLOW: "border-success/25 bg-success-bg text-success",
  HOLD: "border-pending/25 bg-pending-bg text-pending",
  REJECT: "border-danger/25 bg-danger-bg text-danger",
};

/**
 * One text through the rules and the classifier, the way the services would screen it right now —
 * a term added a second ago included. Where it would be shown matters: a link means something else
 * in a caption than in a comment.
 *
 * A result is dropped as soon as the text or the place changes, so what is on screen is always the
 * verdict on what is in the box.
 */
export function TextPreview() {
  const [surface, setSurface] = useState<TextSurface>("COMMENT");
  const [text, setText] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [checking, startCheck] = useTransition();

  function check() {
    startCheck(async () => {
      setResult(await previewTextAction(text, surface));
    });
  }

  return (
    <Card>
      <CardHeader
        title="Try a text"
        hint="Runs the word lists, the spam signals and the classifier the way the services would right now. Before each service's own switches: whether one acts on a hold or a refusal is its enforce setting, and a video owner's comment filters come on top."
      />
      <div className="space-y-3 px-5 py-4">
        <Segmented
          options={SURFACE_OPTIONS}
          value={surface}
          onChange={(next) => {
            setSurface(next);
            setResult(null);
          }}
        />
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          onKeyDown={(e) => {
            // isComposing: Enter also commits a word in an input method, Vietnamese Telex among them.
            if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (text.trim() && !checking) check();
          }}
          rows={3}
          placeholder={PLACEHOLDERS[surface]}
          className="block w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none placeholder:text-ink-faint"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={check}
            disabled={checking || !text.trim()}
            className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {checking ? "Checking..." : "Check"}
          </button>
          <span className="text-[11px] text-ink-faint">or ⌘/Ctrl + Enter</span>
        </div>

        {result ? (
          result.ok ? (
            <Verdict preview={result.preview} />
          ) : (
            <p className="text-[11px] text-ink-soft">{result.message}</p>
          )
        ) : null}
      </div>
    </Card>
  );
}

function Verdict({ preview }: { preview: TextPreviewResponse }) {
  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-surface-muted px-3 py-3">
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-1 text-[11px] font-medium",
          DECISION_STYLES[preview.decision],
        )}
      >
        {TEXT_DECISION_LABELS[preview.decision]}
      </span>

      {preview.flags.length > 0 ? (
        <ul className="space-y-1.5 text-[11px]">
          {preview.flags.map((flag, i) => (
            // Two links to the same domain are two flags with the same text.
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium">{categoryLabel(flag.category)}</span>
              <span className="figure wrap-anywhere text-ink-soft">{flag.rule}</span>
              <span className="text-ink-faint">
                {FLAG_SOURCE_LABELS[flag.source]} · {flagWeight(flag.severity)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-ink-faint">Nothing fired.</p>
      )}

      <p className="text-[11px] text-ink-faint">
        Decided with <span className="figure break-all">{preview.version}</span>.
        {preview.classifierAnswered
          ? null
          : " The classifier did not answer — switched off or unreachable — so this is the rules' verdict alone, which is what the services fall back to as well."}
      </p>
    </div>
  );
}
