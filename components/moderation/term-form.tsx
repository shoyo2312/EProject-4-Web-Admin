"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import { addTermAction } from "@/app/(admin)/moderation/terms/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type { ModerationTermAction, TextCategory } from "@/lib/api/types";
import { TERM_ACTION_LABELS, TEXT_CATEGORY_LABELS } from "@/lib/labels";
import { TERM_ACTIONS } from "@/lib/list-filters";
import { TERM_CATEGORIES, matchesAnyDiacritics } from "@/lib/moderation-terms";

const ACTION_OPTIONS = TERM_ACTIONS.map((value) => ({ value, label: TERM_ACTION_LABELS[value] }));

const ACTION_EFFECTS: Record<ModerationTermAction, string> = {
  HOLD: "A match waits for a person: a comment for the video's owner, a caption for review.",
  REJECT: "A match is refused outright, and a refused comment is a strike against its author.",
  EXEMPT:
    "Takes a term out of the shipped list — for a false positive, until a release fixes the list.",
};

/**
 * A term for the list, sent the way admin-service takes it. Category is asked for rather than
 * defaulted: what a match is filed under is what a moderator later reads on the held comment.
 *
 * Enter does not submit, as in every other form here: a REJECT term refuses comments platform-wide
 * within a minute, and a stray Enter — or one that commits a word in a Vietnamese input method —
 * should not be what adds it.
 */
export function TermForm() {
  const router = useRouter();
  const [action, setAction] = useState<ModerationTermAction>("HOLD");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<TextCategory | "">("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const exempt = action === "EXEMPT";
  const written = term.trim();

  function submit() {
    startSubmit(async () => {
      const outcome = await addTermAction({
        term,
        action,
        category: exempt || !category ? null : category,
        note,
      });
      setResult(outcome.message);
      if (outcome.ok) {
        setTerm("");
        setNote("");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Add a term"
        hint="On top of the list every service ships with, or taken out of it. The preview uses a change at once; every service within a minute, without a deploy."
      />
      <div className="space-y-3 px-5 py-4">
        <div className="space-y-1.5">
          <Segmented options={ACTION_OPTIONS} value={action} onChange={setAction} />
          <p className="text-[11px] text-ink-faint">{ACTION_EFFECTS[action]}</p>
        </div>

        <label className="block space-y-1.5">
          <span className="label-caps text-[10px] text-ink-faint">Term</span>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={exempt ? "A term on the shipped list, as it is written there" : "e.g. nhà cái uy tín"}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none placeholder:text-ink-faint"
          />
          <span className="block text-[11px] text-ink-faint">
            {written
              ? matchesAnyDiacritics(written)
                ? "Written without diacritics: it matches every spelling, accented or not."
                : "Written with diacritics: it matches only these diacritics. The plain spelling is a different term."
              : "How it is written decides how it matches: “nhà cái” matches only that spelling, “nha cai” every spelling — two different terms."}
          </span>
        </label>

        {exempt ? null : (
          <label className="block space-y-1.5">
            <span className="label-caps text-[10px] text-ink-faint">Category</span>
            <span className="relative block">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TextCategory | "")}
                className="w-full appearance-none rounded-lg border border-line bg-surface py-2 pr-8 pl-3 text-[12px] outline-none"
              >
                <option value="">What a match is…</option>
                {TERM_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {TEXT_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            </span>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="label-caps text-[10px] text-ink-faint">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why — for the next admin reading the list (optional)"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none placeholder:text-ink-faint"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !written || (!exempt && !category)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            {submitting ? "Submitting..." : exempt ? "Exempt term" : "Add term"}
          </button>
          {result ? <p className="text-[11px] text-ink-soft">{result}</p> : null}
        </div>
      </div>
    </Card>
  );
}
