import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { TermForm } from "@/components/moderation/term-form";
import { TermsTable } from "@/components/moderation/terms-table";
import { TextPreview } from "@/components/moderation/text-preview";
import { Card, CardHeader } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { Field } from "@/components/ui/row-detail";
import { getAdminHandles } from "@/lib/api/names";
import { LIST_PAGE_SIZE, referenceNow } from "@/lib/api/shared";
import { getModerationTermSummary, listModerationTerms } from "@/lib/api/terms";
import { parsePage } from "@/lib/api/window";
import { formatNumber } from "@/lib/format";
import { termFilters } from "@/lib/list-filters";

/**
 * The word list text moderation screens with, as far as admins change it: terms added on top of
 * the list every service ships with, and shipped terms taken out of it. Until this page, the only
 * way to change it without a release was a request by hand.
 */
export default async function ModerationTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q, action } = termFilters(params);
  const pageIndex = parsePage(params.page);

  let page;
  let summary;
  try {
    [page, summary] = await Promise.all([
      listModerationTerms({ q, action, page: pageIndex }),
      getModerationTermSummary(),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Moderation Terms" />
        <ErrorState error={error} />
      </>
    );
  }

  // Who added each term, by @handle. Non-fatal: the rows fall back to id tails.
  const handles = await getAdminHandles(page.content.map((term) => term.createdBy));

  return (
    <>
      <PageHeader
        title="Moderation Terms"
        subtitle="Words added to the list every service ships with, or taken out of it. Live within a minute, without a deploy."
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="The list in force"
            hint="The shipped file changes only with a release; the admin terms on top of it change here. Every held comment and screened caption records the version it was decided with."
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[12px] xl:grid-cols-4">
            <Field label="Shipped list">
              <span className="figure">{formatNumber(summary.shippedTerms)}</span> terms
              <span className="text-ink-faint"> · version {summary.shippedVersion}</span>
            </Field>
            <Field label="Admin terms">
              <span className="figure">{formatNumber(summary.adminTerms)}</span> live
              <span className="text-ink-faint"> — exemptions included</span>
            </Field>
            <Field label="Revision">
              <span className="figure">{summary.revision}</span>
              <span className="text-ink-faint"> — moved by every add and removal</span>
            </Field>
            <Field label="Verdicts record">
              <span className="figure break-all">{summary.version}</span>
            </Field>
          </dl>
        </Card>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <TermForm />
          <TextPreview />
        </div>

        <TermsTable
          terms={page.content}
          handles={handles}
          query={q ?? ""}
          action={action ?? "ALL"}
          now={referenceNow()}
        />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="terms"
        />
      </div>
    </>
  );
}
