import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Skeleton, pick } from "@/components/ui/skeleton";

/* Enough to fill the picker's list on a laptop. */
const PICKER_ROWS = 8;
const REPORTED_ROWS = 5;

/**
 * The page as the sidebar opens it, with no video picked: a skeleton cannot read `?videoId`, and
 * picking a video from the list keeps the page on screen instead of showing this.
 */
export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Comments"
        subtitle="Reported comments come first; any other thread opens from its video. Every removal is recorded in the audit log, and there is no undo."
      />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="flex flex-col lg:max-h-[calc(100dvh-6rem)]">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Block className="h-8 w-8 rounded-lg" />
            <span className="min-w-0 flex-1">
              <Bone className="w-32" />
              <Bone className="w-44" />
            </span>
          </div>
          <CardHeaderSkeleton title="w-16" />
          <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            <div className="border-b border-line px-4 py-3">
              <Block className="h-9 w-full rounded-lg" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {Array.from({ length: PICKER_ROWS }, (_, i) => (
                <div
                  key={i}
                  className="flex w-full items-start gap-2.5 border-b border-line px-4 py-2.5 text-[12px] last:border-b-0"
                >
                  <Block className="h-11 w-8 rounded" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      <Bone className={pick(i, "w-48", "w-40", "w-52", "w-36")} />
                    </span>
                    <Bone className="w-24" />
                    <Bone className="w-16" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeaderSkeleton title="w-36" />
          <div className="divide-y divide-line">
            {Array.from({ length: REPORTED_ROWS }, (_, i) => (
              <div key={i} className="space-y-2.5 px-5 py-3.5 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <Bone className={pick(i, "w-72", "w-56", "w-64")} />
                  <Block className="h-7 w-20 rounded-md" />
                </div>
                <div className="flex items-start gap-3">
                  <Block className="h-7 w-7 rounded-full" />
                  <span className="min-w-0 flex-1">
                    <Bone className="w-40" />
                    <Bone className={pick(i, "w-96", "w-80", "w-72")} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Skeleton>
  );
}
