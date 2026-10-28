import { EngagementTrendSkeleton } from "@/components/dashboard/engagement-trend";
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards";
import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { ReportsTableSkeleton } from "@/components/moderation/reports-table-skeleton";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Skeleton, pick } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Welcome back, admin"
        subtitle="12 videos and 15 reports waiting for review."
        filters
        csv
      />
      <div className="space-y-4">
        <section>
          <h2 className="mb-3 text-[13px]">
            <Bone className="w-24" />
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((tile) => (
              <div
                key={tile}
                className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card"
              >
                <span className="text-[13px]">
                  <Bone className={pick(tile, "w-28", "w-24", "w-32")} />
                </span>
                <span className="text-[32px] leading-none">
                  <Bone className="w-10" />
                </span>
                <span className="text-[12px]">
                  <Bone className={pick(tile, "w-48", "w-56", "w-32")} />
                </span>
              </div>
            ))}
          </div>
        </section>

        <KpiCardsSkeleton />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card>
            <CardHeaderSkeleton title="w-28" />
            <dl className="grid gap-5 px-5 py-4">
              <Figure label="w-36" value="w-8" />
              <div>
                <Figure label="w-32" value="w-16" note="w-44" />
                <Block className="mt-2 h-1.5 rounded-full" />
              </div>
              <Figure label="w-36" value="w-8" note="w-52" />
            </dl>
          </Card>

          <Card className="flex flex-col">
            <CardHeaderSkeleton title="w-32" />
            <ol className="relative px-5 py-2">
              <span className="absolute top-5 bottom-5 left-[23px] w-px bg-line" />
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="relative flex gap-3 py-2.5">
                  <span className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full border-2 border-surface bg-line ring-1 ring-line" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">
                      <Bone className={pick(i, "w-56", "w-48", "w-64", "w-44")} />
                    </span>
                    <span className="mt-0.5 block text-[12px]">
                      <Bone className="w-24" />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-auto border-t border-line px-5 py-3">
              <span className="text-[12px]">
                <Bone className="w-24" />
              </span>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeaderSkeleton title="w-32" />
            <ul className="divide-y divide-line">
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3">
                  <Block className="h-8 w-8 rounded-full" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px]">
                      <Bone className={pick(i, "w-28", "w-24", "w-32")} />
                    </span>
                    <span className="block text-[12px]">
                      <Bone className="w-20" />
                    </span>
                  </span>
                  <Block className="h-[22px] w-6 rounded-full" />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <EngagementTrendSkeleton />

        <ReportsTableSkeleton rows={8} />
      </div>
    </Skeleton>
  );
}

/** One of `ModerationPace`'s figures: its label, the number, and the note under it. */
function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[12px]">
        <Bone className={label} />
      </dt>
      <dd className="mt-1">
        <span className="block text-[22px] leading-none">
          <Bone className={value} />
        </span>
        {note ? (
          <span className="mt-1.5 block text-[12px]">
            <Bone className={note} />
          </span>
        ) : null}
      </dd>
    </div>
  );
}
