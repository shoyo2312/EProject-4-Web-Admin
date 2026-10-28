import { PageHeaderSkeleton } from "@/components/layout/page-header";
import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import {
  Block,
  Bone,
  FieldsSkeleton,
  Lines,
  Skeleton,
  TableSkeleton,
  pick,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <Skeleton>
      <PageHeaderSkeleton
        title="Settings"
        subtitle="What automatic moderation is deciding with, as each service reports it. Read-only — every value lives in a service's own environment."
      />
      <div className="space-y-4">
        <Card>
          <CardHeaderSkeleton title="w-40" />
          {/* The thresholds, the harm labels beside them, and the second opinion: five rows. */}
          <FieldsSkeleton count={18} className="px-5 py-4" />
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-28" />
          <div className="space-y-3 px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px] xl:grid-cols-4">
              <Field value={["w-56", "w-40"]} />
              <Field value={["w-24"]} />
              <Field value={["w-48"]} />
              <Field value={["w-16"]} />
              <div className="col-span-2">
                <Field value={["w-80"]} />
              </div>
            </dl>
            <p className="text-[12px]">
              <Bone className="w-96" />
            </p>
          </div>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-44" actions={<Block className="h-[21px] w-52 rounded-full" />} />
          <TableSkeleton
            rows={3}
            className="xl:min-w-[640px]"
            columns={[
              {
                className: "px-5 py-3",
                width: "w-[26%]",
                head: <Bone className="w-12" />,
                cell: (row) => <Bone className={pick(row, "w-24", "w-28", "w-20")} />,
              },
              ...["w-[25%]", "w-[16%]"].map((width) => ({
                className: "px-3 py-3",
                width,
                head: <Bone className="w-24" />,
                cell: () => <Block className="h-[21px] w-[74px] rounded-full" />,
              })),
              {
                className: "px-5 py-3",
                head: <Bone className="w-16" />,
                cell: () => <Bone className="w-32" />,
              },
            ]}
          />
          <p className="border-t border-line px-5 py-3 text-[12px]">
            <Bone className="w-96" />
          </p>
        </Card>

        <Card>
          <CardHeaderSkeleton title="w-44" />
          <ul className="list-disc space-y-1.5 py-4 pr-5 pl-10 text-[13px] marker:text-line">
            <li>
              <Bone className="w-[34rem]" />
            </li>
            <li>
              <Bone className="w-[30rem]" />
            </li>
          </ul>
        </Card>
      </div>
    </Skeleton>
  );
}

/** A `Field` whose value runs to `value.length` lines. */
function Field({ value }: { value: string[] }) {
  return (
    <div>
      <dt className="label text-[11px]">
        <Bone className="w-16" />
      </dt>
      <dd className="mt-0.5">
        <Lines widths={value} />
      </dd>
    </div>
  );
}
