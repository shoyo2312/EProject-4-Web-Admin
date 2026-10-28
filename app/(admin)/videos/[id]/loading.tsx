import { BackLinkSkeleton } from "@/components/layout/back-link";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, FieldsSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Skeleton>
      <BackLinkSkeleton width="w-16" />
      <PageHeaderSkeleton
        title="Một buổi chiều ở phố cổ, ghé quán cà phê quen và ngồi nghe mưa rơi"
        subtitle="Published · PUBLIC · uploaded 27/10/2026, 21:00:00"
      />

      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-16" />
          <div className="px-5 py-4">
            {/* The player is held to 60% of the screen's height, whatever the video's shape. */}
            <Block className="h-[60vh] w-full rounded-lg" />
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-14" />
          <FieldsSkeleton count={18} className="px-5 py-4" />
          <div className="border-t border-line px-5 py-3">
            <span className="text-[12px]">
              <Bone className="w-44" />
            </span>
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-40" />
          <div className="px-5 py-4">
            <FieldsSkeleton count={7} />
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-28" />
          <div className="space-y-3 px-5 py-4">
            <FieldsSkeleton count={4} />
            <p className="text-[13px]">
              <Bone className="w-60" />
            </p>
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-36" />
          <div className="space-y-2 px-5 py-4 text-[12px]">
            <p>
              <Bone className="w-56" />
            </p>
            <p>
              <Bone className="w-72" />
            </p>
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-16" />
          <div className="flex flex-wrap gap-2 px-5 py-4">
            {["w-28", "w-24", "w-20"].map((width) => (
              <Block key={width} className={`h-8 rounded-md ${width}`} />
            ))}
          </div>
        </Card>
      </div>
    </Skeleton>
  );
}
