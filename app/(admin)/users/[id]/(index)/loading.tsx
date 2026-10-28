import { BackLinkSkeleton } from "@/components/layout/back-link";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, FieldsSkeleton, Ghost, Skeleton } from "@/components/ui/skeleton";

/* A row of uploads at full width; most accounts have fewer than a row. */
const UPLOAD_TILES = 8;

/* In a route group so it stands in for the account alone, not for its activity page. */
export default function Loading() {
  return (
    <Skeleton>
      <BackLinkSkeleton width="w-20" />

      <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Block className="h-14 w-14 rounded-full" />
          <div>
            <h1 className="text-[26px] leading-tight font-bold">
              <Ghost>@tuan.hung.cars</Ghost>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
              <Block className="h-[22px] w-16 rounded-full" />
              <span>
                <Ghost>· USER · joined 27/10/2026, 18:44:57</Ghost>
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {["w-12", "w-12", "w-8"].map((width, i) => (
            <div key={i} className="text-right">
              <div className="text-[18px] leading-tight font-bold">
                <Bone className="w-8" />
              </div>
              <div className="label text-[11px]">
                <Bone className={width} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-16" />
          <FieldsSkeleton count={12} badges={[1]} className="px-5 py-4" />
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-24" />
          <div className="px-5 py-4">
            <FieldsSkeleton count={4} />
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-48" />
          <div className="grid grid-cols-3 gap-2.5 p-4 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {Array.from({ length: UPLOAD_TILES }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-line">
                <Block className="aspect-[9/16] w-full" />
                <div className="px-1.5 py-1">
                  <p className="text-[11px]">
                    <Bone className="w-full" />
                  </p>
                  <p className="text-[10px]">
                    <Bone className="w-12" />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-36" actions={<Bone className="w-20" />} />
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
            {["w-24", "w-20", "w-32"].map((width) => (
              <Block key={width} className={`h-8 rounded-md ${width}`} />
            ))}
          </div>
        </Card>
      </div>
    </Skeleton>
  );
}
