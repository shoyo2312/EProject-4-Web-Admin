import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Skeleton, pick } from "@/components/ui/skeleton";

/* Items per day, for a few days back. */
const DAYS = [3, 2, 2];

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Notifications"
        subtitle="Open reports, held videos, trash about to be erased, and the last day's sign-ups and uploads."
      />
      <div className="space-y-3">
        <p className="text-[13px]">
          <Bone className="w-48" />
        </p>
        <Card>
          <CardHeaderSkeleton
            title="w-36"
            actions={<Block className="h-9 w-[326px] max-w-full rounded-lg" />}
          />
          {DAYS.map((items, day) => (
            <section key={day}>
              <h3 className="label border-b border-line bg-surface-muted px-4 py-1.5 text-[11px]">
                <Bone className="w-16" />
              </h3>
              <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {Array.from({ length: items }, (_, i) => (
                  <li key={i} className="flex gap-3 px-4 py-3">
                    <Block className="mt-0.5 h-8 w-8 rounded-full" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px]">
                        <Bone className={pick(day + i, "w-40", "w-32", "w-48")} />
                      </span>
                      <span className="block text-[13px]">
                        <Bone className={pick(day + i, "w-72", "w-96", "w-64")} />
                      </span>
                      <span className="block text-[12px]">
                        <Bone className="w-14" />
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Card>
      </div>
    </Skeleton>
  );
}
