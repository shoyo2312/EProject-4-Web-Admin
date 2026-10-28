import { Card, CardHeaderSkeleton } from "@/components/ui/card";
import { Block, Bone, Lines, TableSkeleton, pick } from "@/components/ui/skeleton";

/**
 * `ReportsTable` while it loads. With `filters` it is the ledger on the Reports page — its search,
 * its two filters and its sortable headings; without, the dashboard's newest reports and the link
 * under them. Kept out of `reports-table.tsx`, a client module, so it ships no JavaScript.
 */
export function ReportsTableSkeleton({ rows, filters }: { rows: number; filters?: boolean }) {
  // A sortable heading is a button in the table's 13px text, a pixel taller than a plain label.
  const sortable = (width: string) =>
    filters ? (
      <span className="text-[13px]">
        <Bone className={width} />
      </span>
    ) : (
      <Bone className={width} />
    );

  return (
    <Card>
      <CardHeaderSkeleton
        title={filters ? "w-20" : "w-28"}
        actions={
          filters ? (
            <div className="flex flex-wrap items-center gap-2">
              <Block className="h-9 w-[200px] rounded-lg lg:w-[260px]" />
              <Block className="h-9 w-[300px] max-w-full rounded-lg" />
              <Block className="h-9 w-[256px] max-w-full rounded-lg" />
            </div>
          ) : undefined
        }
      />
      <TableSkeleton
        rows={rows}
        className="xl:min-w-[880px]"
        columns={[
          {
            className: "hidden py-3 pr-3 pl-5 xl:table-cell",
            width: "w-[9%]",
            head: sortable("w-5"),
            cell: () => <Bone className="w-16" />,
          },
          {
            className: "hidden px-3 py-3 xl:table-cell",
            width: "w-[13%]",
            head: <Bone className="w-14" />,
            cell: (row) => <Bone className={pick(row, "w-24", "w-28", "w-20")} />,
          },
          {
            className: "py-3 pr-3 pl-5 xl:pl-3",
            width: "w-[27%]",
            head: sortable("w-12"),
            cell: (row) => (
              <span className="inline-flex min-w-0 items-center gap-2 align-middle">
                <Block className="h-[21px] w-[41px] rounded-md" />
                <span className="max-w-[220px]">
                  {row % 2 ? <Bone className="w-36" /> : <Lines widths={["w-52", "w-28"]} />}
                </span>
              </span>
            ),
          },
          {
            className: "hidden px-3 py-3 xl:table-cell",
            width: "w-[24%]",
            head: <Bone className="w-12" />,
            cell: (row) => <Bone className={pick(row, "w-36", "w-44", "w-28")} />,
          },
          {
            className: "px-3 py-3",
            width: "w-[10%]",
            head: sortable("w-10"),
            cell: () => <Block className="h-[26px] w-[90px] rounded-full" />,
          },
          {
            className: "px-3 py-3",
            width: "w-[6%]",
            head: sortable("w-12"),
            cell: () => <Bone className="w-12" />,
          },
          {
            className: "px-5 py-3 text-right",
            head: <Bone className="w-12" />,
            cell: () => (
              <span className="text-[12px]">
                <Bone className="w-12" />
              </span>
            ),
          },
        ]}
      />
      {filters ? null : (
        <div className="border-t border-line px-5 py-3 text-right">
          <span className="text-[12px]">
            <Bone className="w-24" />
          </span>
        </div>
      )}
    </Card>
  );
}
