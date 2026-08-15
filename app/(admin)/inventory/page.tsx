import { PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardMenuButton } from "@/components/ui/card";
import { mockInventory } from "@/lib/mock/inventory";
import { formatNumber, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const LOW_STOCK = 40;

export default function InventoryPage() {
  const lowStock = mockInventory.filter((row) => row.available < LOW_STOCK);

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${lowStock.length} of ${mockInventory.length} SKUs are below the ${LOW_STOCK}-unit threshold.`}
      />

      <Card>
        <CardHeader
          title="Stock Levels"
          hint="GET /api/v1/inventory/{productId} · POST /api/v1/inventory/{productId}/restock"
          actions={<CardMenuButton />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="label-caps px-5 py-3 text-ink-soft">Product</th>
                <th className="label-caps px-3 py-3 text-ink-soft">Product ID</th>
                <th className="label-caps px-3 py-3 text-right text-ink-soft">
                  Available
                </th>
                <th className="label-caps px-3 py-3 text-right text-ink-soft">
                  Reserved
                </th>
                <th className="label-caps px-3 py-3 text-ink-soft">Updated</th>
                <th className="label-caps px-5 py-3 text-right text-ink-soft">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {mockInventory.map((row) => {
                const low = row.available < LOW_STOCK;
                return (
                  <tr
                    key={row.productId}
                    className="border-b border-line last:border-b-0 transition-colors hover:bg-surface-muted"
                  >
                    <td className="px-5 py-3 font-medium whitespace-nowrap">
                      {row.productName}
                    </td>
                    <td className="figure px-3 py-3 whitespace-nowrap text-ink-faint">
                      {row.productId.slice(-8)}
                    </td>
                    <td
                      className={cn(
                        "figure px-3 py-3 text-right font-semibold",
                        low && "text-danger",
                      )}
                    >
                      {formatNumber(row.available)}
                      {low ? <span className="ml-1.5 text-[10px]">LOW</span> : null}
                    </td>
                    <td className="figure px-3 py-3 text-right text-ink-soft">
                      {formatNumber(row.reserved)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
                      {relativeTime(row.updatedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors hover:bg-surface"
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
