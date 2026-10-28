import { BackLinkSkeleton } from "@/components/layout/back-link";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Lines, PagerSkeleton, Skeleton, pick } from "@/components/ui/skeleton";

/* Most accounts have a short trail: sign-ins, an upload or two. */
const EVENTS = 4;

export default function Loading() {
  return (
    <Skeleton>
      <BackLinkSkeleton width="w-24" />
      <PageHeaderSkeleton
        title="Activity — @minh.nguyen"
        subtitle="12 recorded events across security, content and moderation"
      />

      <Card>
        <CardHeaderSkeleton
          title="w-14"
          actions={<Block className="h-9 w-[312px] max-w-full rounded-lg" />}
        />
        <ol className="px-5 py-2">
          {Array.from({ length: EVENTS }, (_, i) => (
            <li key={i} className="group relative flex gap-3 py-3">
              <span className="absolute top-8 bottom-0 left-[13px] w-px bg-line group-last:hidden" />
              <Block className="relative h-[27px] w-[27px] rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-x-2">
                  <span className="text-[13px] font-medium">
                    <Bone className={pick(i, "w-20", "w-32", "w-28", "w-40")} />
                  </span>
                  <span className="label text-[11px]">
                    <Bone className="w-12" />
                  </span>
                </div>
                <p className="mt-0.5 text-[12px]">
                  <Bone className={pick(i, "w-40", "w-56", "w-48")} />
                </p>
                <p className="mt-0.5 text-[12px]">
                  <Bone className="w-44" />
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="border-t border-line px-4 py-2">
          <PagerSkeleton />
        </div>
      </Card>

      <p className="mt-3 px-1 text-[12px]">
        <Lines widths={["w-[88rem]", "w-[44rem]"]} />
      </p>
    </Skeleton>
  );
}
