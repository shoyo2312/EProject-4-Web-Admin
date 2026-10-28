import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Lines, Skeleton, pick } from "@/components/ui/skeleton";

/* Enough to fill the picker's 560px list. */
const PICKER_ROWS = 10;

/**
 * The page as the sidebar opens it, with no video picked: a skeleton cannot read `?videoId`, and
 * picking a video from the list keeps the page on screen instead of showing this.
 */
export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Comments"
        subtitle="Read a video's thread and remove a comment on a user's behalf. Removals are recorded in the audit log; there is no undo."
        filters
      />
      <div className="mb-4">
        <KpiCardsSkeleton count={2} />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex h-full flex-col">
          <CardHeaderSkeleton title="w-24" />
          <div className="border-b border-line px-4 py-3">
            <Block className="h-9 w-full rounded-lg" />
          </div>
          <div className="max-h-[320px] flex-1 overflow-hidden lg:max-h-[560px]">
            {Array.from({ length: PICKER_ROWS }, (_, i) => (
              <div
                key={i}
                className="flex w-full items-start gap-2 border-b border-line px-4 py-2.5 text-[12px] last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    <Bone className={pick(i, "w-56", "w-48", "w-60", "w-44")} />
                  </span>
                  <Bone className="w-16" />
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
          <Block className="h-5 w-5 rounded-md" />
          <p className="text-[13px]">
            <Bone className="w-48" />
          </p>
          <p className="max-w-sm text-[12px]">
            <Lines widths={["w-80", "w-72", "w-44"]} />
          </p>
        </Card>
      </div>
    </Skeleton>
  );
}
