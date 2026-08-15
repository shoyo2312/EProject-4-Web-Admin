import type { InventoryResponse } from "@/lib/api/types";
import { MOCK_NOW, between, seededRandom } from "./random";

/** Product names are display-only — inventory-service keys everything by productId. */
export const MOCK_PRODUCT_NAMES = [
  "Ergo Office Chair",
  "Sunset Desk 02",
  "Eco Bookshelf",
  "Green Leaf Desk",
  "Studio Ring Light",
  "Clip-on Mic Pro",
  "Phone Gimbal X2",
  "Softbox Kit 60cm",
  "Creator Tripod",
  "Backdrop Stand",
  "LED Panel Mini",
  "Lens Filter Pack",
];

export interface InventoryRow extends InventoryResponse {
  productName: string;
}

export const mockInventory: InventoryRow[] = (() => {
  const rand = seededRandom(6060);
  return MOCK_PRODUCT_NAMES.map((productName, i) => {
    const available = between(rand, 0, 480);
    return {
      productId: String(7_260_000_000_000_000_000n + BigInt(i * 7919 + 13)),
      productName,
      available,
      reserved: between(rand, 0, Math.max(1, Math.round(available * 0.3))),
      updatedAt: new Date(
        MOCK_NOW - between(rand, 5, 60 * 24 * 4) * 60_000,
      ).toISOString(),
    };
  });
})();
