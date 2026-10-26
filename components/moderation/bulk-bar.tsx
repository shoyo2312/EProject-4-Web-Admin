"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ReasonForm } from "@/components/moderation/reason-form";
import type { ModerationResult } from "@/lib/moderation";
import type { Selection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";

export interface BulkAction<K extends string = string> {
  key: K;
  label: string;
  /** How many of the ticked rows it applies to; an action for none of them is not offered. */
  count: number;
  presets: readonly string[];
  confirm: string;
  tone?: "danger" | "success";
  /** Above the reason — a ban's length. */
  extra?: ReactNode;
}

/**
 * The strip above a table once rows are ticked: what can be done to them, then one reason for all.
 * Each row still gets its own audit entry; the reason is simply the same in each.
 */
export function BulkBar<K extends string>({
  count,
  actions,
  onRun,
  onClear,
}: {
  count: number;
  actions: BulkAction<K>[];
  onRun: (key: K, reason: string) => Promise<ModerationResult>;
  onClear: () => void;
}) {
  const [open, setOpen] = useState<K | null>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const offered = actions.filter((action) => action.count > 0);
  const action = offered.find((candidate) => candidate.key === open);

  if (count === 0 && result === null) return null;

  function submit() {
    if (!action) return;
    startSubmit(async () => {
      const outcome = await onRun(action.key, reason);
      setResult(outcome.message);
      // Closed either way: the rows it could not apply to stay ticked, and the next try starts
      // from a fresh choice rather than from a form still holding the last reason.
      setOpen(null);
      setReason("");
    });
  }

  return (
    <div className="border-b border-line bg-surface-muted px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {count > 0 ? <span className="text-[12px] font-medium">{count} selected</span> : null}
        {offered.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            disabled={submitting}
            aria-pressed={open === candidate.key}
            onClick={() => {
              setOpen(open === candidate.key ? null : candidate.key);
              setReason("");
              setResult(null);
            }}
            className={cn(
              "rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] transition-colors hover:bg-canvas disabled:opacity-40",
              candidate.tone === "danger" && "text-danger",
              candidate.tone === "success" && "text-success",
            )}
          >
            {candidate.label} {candidate.count}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onClear();
            setOpen(null);
            setResult(null);
          }}
          className="ml-auto text-[12px] text-ink-soft underline-offset-4 hover:underline"
        >
          {count > 0 ? "Clear selection" : "Dismiss"}
        </button>
      </div>

      {action ? (
        <div className="mt-3 space-y-2">
          {action.extra}
          <ReasonForm
            presets={action.presets}
            reason={reason}
            onReason={setReason}
            onSubmit={submit}
            onCancel={() => setOpen(null)}
            submitting={submitting}
            placeholder={`One reason for all ${action.count} — pick one above or write your own`}
            confirmLabel={`${action.confirm} (${action.count})`}
          />
        </div>
      ) : null}

      {result ? (
        <p role="status" className="mt-2 text-[12px] text-ink-soft">
          {result}
        </p>
      ) : null}
    </div>
  );
}

const CHECKBOX =
  "h-3.5 w-3.5 cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed";

/** The whole cell is the target — a 14px box alone is under the 24px a pointer needs. */
const CELL_LABEL = "flex cursor-pointer items-center py-3 pr-3 pl-5";

/** The header cell that ticks or clears every selectable row on the page. */
export function SelectAllCell({ ids, selection }: { ids: readonly string[]; selection: Selection }) {
  const ref = useRef<HTMLInputElement>(null);
  const ticked = ids.filter((id) => selection.selected.has(id)).length;
  const all = ids.length > 0 && ticked === ids.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = ticked > 0 && !all;
  }, [ticked, all]);

  return (
    <th className="w-8 p-0">
      <label className={CELL_LABEL}>
        <input
          ref={ref}
          type="checkbox"
          aria-label="Select every row on this page"
          disabled={ids.length === 0}
          checked={all}
          onChange={() => (all ? selection.clear() : selection.set(ids))}
          className={CHECKBOX}
        />
      </label>
    </th>
  );
}

/**
 * A row's tick box. The cell swallows clicks and keys: the row around it opens its details on
 * both, and Space there would toggle the row instead of the box.
 */
export function SelectCell({
  id,
  label,
  selection,
  disabledReason,
}: {
  id: string;
  label: string;
  selection: Selection;
  /** Why this row cannot be ticked; the box is disabled whenever there is one. */
  disabledReason?: string | null;
}) {
  const disabled = Boolean(disabledReason);
  return (
    <td
      className="w-8 p-0"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label title={disabledReason ?? undefined} className={cn(CELL_LABEL, disabled && "cursor-not-allowed")}>
        <input
          type="checkbox"
          aria-label={label}
          disabled={disabled}
          checked={!disabled && selection.selected.has(id)}
          onChange={() => selection.toggle(id)}
          className={CHECKBOX}
        />
      </label>
    </td>
  );
}
