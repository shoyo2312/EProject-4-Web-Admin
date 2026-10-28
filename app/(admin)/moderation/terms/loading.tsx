import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  FieldsSkeleton,
  Lines,
  PagerSkeleton,
  Skeleton,
  TableSkeleton,
  pick,
} from "@/components/ui/skeleton";

/* The admin list is short — a handful of terms on top of the shipped file. */
const TERM_ROWS = 6;

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Moderation Terms"
        subtitle="Words added to the list every service ships with, or taken out of it. Live within a minute, without a deploy."
      />
      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-28" />
          <FieldsSkeleton count={4} className="px-5 py-4" />
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <Card>
            <CardHeaderSkeleton title="w-20" />
            <div className="space-y-3 px-5 py-4">
              <div className="space-y-1.5">
                <Block className="h-9 rounded-lg" />
                <p className="text-[12px]">
                  <Bone className="w-96" />
                </p>
              </div>
              <Input label="w-8" hint={["w-full", "w-64"]} />
              <Input label="w-12" />
              <Input label="w-8" />
              <Block className="h-[34px] w-24 rounded-md" />
            </div>
          </Card>
          <Card>
            <CardHeaderSkeleton title="w-16" />
            <div className="space-y-3 px-5 py-4">
              <Block className="h-9 rounded-lg" />
              <Block className="h-[77px] rounded-lg" />
              <div className="flex items-center gap-3">
                <Block className="h-[34px] w-[60px] rounded-md" />
                <span className="text-[12px]">
                  <Bone className="w-24" />
                </span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeaderSkeleton
            title="w-24"
            actions={
              <>
                <Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />
                <Block className="h-9 w-[227px] max-w-full rounded-lg" />
              </>
            }
          />
          <TableSkeleton
            rows={TERM_ROWS}
            className="xl:min-w-[760px]"
            columns={[
              {
                className: "px-5 py-3",
                width: "w-[50%]",
                head: <Bone className="w-8" />,
                cell: (row) => (
                  <>
                    <span className="font-medium">
                      <Bone className={pick(row, "w-12", "w-20", "w-16")} />
                    </span>
                    <p className="mt-0.5 text-[12px]">
                      <Bone className={pick(row, "w-72", "w-56", "w-80")} />
                    </p>
                  </>
                ),
              },
              {
                className: "px-3 py-3",
                width: "w-[9%]",
                head: <Bone className="w-10" />,
                cell: () => <Block className="-my-px h-[23px] w-[53px] rounded-md" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[9%]",
                head: <Bone className="w-14" />,
                cell: () => <Bone className="w-10" />,
              },
              {
                className: "px-3 py-3",
                width: "w-[16%]",
                head: <Bone className="w-10" />,
                cell: () => <Bone className="w-28" />,
              },
              {
                className: "px-5 py-3 text-right",
                head: <Bone className="w-12" />,
                cell: () => <Block className="ml-auto h-8 w-[86px] rounded-md" />,
              },
            ]}
          />
        </Card>

        <PagerSkeleton />
      </div>
    </Skeleton>
  );
}

/**
 * One of the form's fields, laid out as its label: the caption sits on a line of the label's own
 * 14px, and the input under it gets the field's 6px only when a hint follows.
 */
function Input({ label, hint }: { label: string; hint?: string[] }) {
  return (
    <div className="block space-y-1.5">
      <span className="label text-[11px]">
        <Bone className={label} />
      </span>
      <Block className="h-[38px] rounded-lg" />
      {hint ? (
        <span className="block text-[12px]">
          <Lines widths={hint} />
        </span>
      ) : null}
    </div>
  );
}
