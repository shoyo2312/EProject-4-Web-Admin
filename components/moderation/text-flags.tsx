import { CAPTION_FIELD_LABELS, categoryLabel } from "@/lib/labels";
import type { TextFlag } from "@/lib/text-flags";

/**
 * Text moderation's flags as tags: where in a caption, which category, and what fired as the
 * service wrote it — the term, the link's domain, the classifier's score. Monochrome on purpose:
 * colour stays with status, and a flag is evidence for a decision, not the decision.
 */
export function TextFlags({ flags }: { flags: TextFlag[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {flags.map((flag, i) => (
        <li
          // Two links to the same domain are two flags with the same text.
          key={i}
          className="inline-flex max-w-full items-center gap-1.5 rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[11px]"
        >
          {flag.field ? <span className="text-ink-faint">{CAPTION_FIELD_LABELS[flag.field]}</span> : null}
          <span className="font-medium text-ink-soft">{categoryLabel(flag.category)}</span>
          {flag.rule ? <span className="figure wrap-anywhere text-ink-faint">{flag.rule}</span> : null}
        </li>
      ))}
    </ul>
  );
}
