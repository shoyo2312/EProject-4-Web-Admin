"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Pick or write the reason, then confirm. The strip a ban, an unban, a takedown and a restore
 * all need, wherever the decision is started from — a directory row or the target's own page.
 *
 * Presentational: the parent owns the reason string (null while the form is closed) and the
 * submit, because the parent is what knows which target this is and what to do afterwards.
 *
 * Here the action is already settled by which button was pressed, and the only question left is
 * why. `ResolveForm` puts a choice of action above it, because closing a report has to offer
 * DISMISS_REPORT beside the enforcement.
 */
export function ReasonForm({
  presets,
  reason,
  onReason,
  onSubmit,
  onCancel,
  submitting,
  placeholder,
  confirmLabel,
  submitOnEnter,
}: {
  presets: readonly string[];
  reason: string;
  onReason: (reason: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  placeholder: string;
  confirmLabel: string;
  /**
   * Enter in the reason box confirms. Opt-in, for the review screen, where every other step is a
   * key too; the directory forms leave Enter inert, so a stray one cannot ban an account.
   */
  submitOnEnter?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function choosePreset(preset: string) {
    // Toggling off leaves an empty box rather than the previous text: clicking the highlighted
    // chip is how an admin says "not that one", and re-showing what they just rejected is wrong.
    onReason(reason === preset ? "" : preset);
    inputRef.current?.focus();
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={reason === preset}
            onClick={() => choosePreset(preset)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
              reason === preset
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-surface text-ink-soft hover:bg-canvas",
            )}
          >
            {preset}
          </button>
        ))}
        <button
          type="button"
          onClick={() => choosePreset("")}
          className="rounded-full border border-dashed border-line px-2.5 py-1 text-[12px] text-ink-faint transition-colors hover:bg-canvas"
        >
          Other…
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          autoFocus
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: Enter also commits a word in an input method (Vietnamese Telex among
            // them), and that Enter is not a confirmation.
            if (!submitOnEnter || e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (reason.trim() && !submitting) onSubmit();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] outline-none transition-[border-color,box-shadow] focus:border-accent focus:ring-2 focus:ring-accent/40 placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !reason.trim()}
          className="rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {submitting ? "Submitting..." : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-line bg-surface px-3 py-2 text-[12px] transition-colors hover:bg-canvas"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
