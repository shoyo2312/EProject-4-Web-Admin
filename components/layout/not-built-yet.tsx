import { Construction } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

/**
 * Phase-1 shell. Each screen states the exact backend gap so the page doubles as
 * the todo list for phase 2 — rather than a blank "coming soon".
 */
export function NotBuiltYet({
  title,
  purpose,
  missing,
}: {
  title: string;
  purpose: string;
  missing: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle={purpose} showFilters={false} />

      <Card className="max-w-3xl px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Construction className="h-4 w-4 text-pending" />
          <h2 className="label-caps text-ink">Blocked on backend</h2>
        </div>
        <p className="mt-3 text-[12px] text-ink-soft">
          The UI for this screen is not built yet because the endpoints it needs do
          not exist. Required before it can ship:
        </p>
        <ul className="mt-4 space-y-2">
          {missing.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-muted px-3 py-2.5 text-[12px]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
              <span className="text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
