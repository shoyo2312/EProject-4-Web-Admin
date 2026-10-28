import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, FieldsSkeleton, Lines, Skeleton } from "@/components/ui/skeleton";

const QUEUE_THUMBS = 12;

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Video Review"
        subtitle="12 videos held by automatic moderation, longest waiting first."
      />
      <div className="space-y-4">
        <Card className="flex items-center gap-2 px-3 py-2">
          <Block className="h-8 w-8 rounded-md" />
          <ol className="flex min-w-0 flex-1 gap-1.5 overflow-hidden px-1 py-1.5">
            {Array.from({ length: QUEUE_THUMBS }, (_, i) => (
              <li key={i} className="shrink-0 p-0.5">
                <Block className="h-12 w-8 rounded" />
              </li>
            ))}
          </ol>
          <Block className="h-8 w-8 rounded-md" />
          <p className="hidden shrink-0 pr-1 text-[12px] sm:block">
            <Bone className="w-28" />
          </p>
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* The player: a portrait upload fills its 70% of the screen's height. */}
          <Card className="overflow-hidden">
            <Block className="h-[70vh] w-full" />
          </Card>

          <div className="min-w-0 space-y-4">
            <Card>
              <div className="space-y-3 px-5 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] leading-snug">
                    <Bone className="w-96" />
                  </h2>
                  <span className="text-[12px]">
                    <Bone className="w-16" />
                  </span>
                </div>
                <FieldsSkeleton count={3} columns="grid-cols-3" />
                <p className="text-[12px]">
                  <Bone className="w-64" />
                </p>
              </div>
              <div className="border-t border-line px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Block className="h-[39px] w-[125px] rounded-md" />
                  <Block className="h-[39px] w-[114px] rounded-md" />
                </div>
                <p className="mt-3 text-[11px]">
                  <Bone className="w-80" />
                </p>
              </div>
            </Card>

            <Card>
              <CardHeaderSkeleton title="w-28" />
              <div className="space-y-4 px-5 py-4">
                <p className="text-[13px]">
                  <Lines widths={["w-full", "w-1/2"]} />
                </p>
                <div>
                  <Block className="h-2 rounded-full" />
                  <div className="mt-1.5 flex h-4 items-center justify-between">
                    <Block className="h-2 w-2 rounded-full" />
                    <Block className="h-2 w-16 rounded-full" />
                    <Block className="h-2 w-2 rounded-full" />
                  </div>
                </div>
                <FieldsSkeleton count={6} columns="grid-cols-2 sm:grid-cols-4" />
              </div>
            </Card>

            <Card>
              <CardHeaderSkeleton title="w-20" actions={<Bone className="w-16" />} />
              <div className="space-y-3 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">
                    <Bone className="w-24" />
                  </span>
                  <Block className="h-[22px] w-[67px] rounded-full" />
                  <span className="text-[12px]">
                    <Bone className="w-24" />
                  </span>
                </div>
                <FieldsSkeleton count={6} columns="grid-cols-3" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Skeleton>
  );
}
