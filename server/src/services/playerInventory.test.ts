import { describe, expect, it, vi } from "vitest";
import { usePlayerInventoryItem } from "./playerInventory.js";

function setup() {
  const tx = {
    economyTransaction: { findUnique: vi.fn().mockResolvedValue(null) },
    playerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "p1", hunger: 50, thirst: 40, energy: 60 }), update: vi.fn().mockResolvedValue({ hunger: 50, thirst: 75, energy: 60 }) },
    playerInventoryItem: { findUnique: vi.fn().mockResolvedValue({ id: "i1", quantity: 3 }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) }
  };
  return { tx, prisma: { $transaction: (fn: any) => fn(tx) } as any };
}

describe("player inventory use", () => {
  it("consumes the requested quantity and applies bounded status effects", async () => {
    const { prisma, tx } = setup();
    const result = await usePlayerInventoryItem(prisma, { userId: "u1", itemCode: "water", quantity: 1, requestId: "00000000-0000-4000-8000-000000000001" });
    expect(result).toMatchObject({ alreadyUsed: false, quantityUsed: 1, inventoryQuantity: 2, status: { thirst: 75 } });
    expect(tx.playerInventoryItem.updateMany).toHaveBeenCalled();
    expect(tx.playerProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ thirst: 75 }) }));
  });

  it("rejects items that are not consumable", async () => {
    const { prisma } = setup();
    await expect(usePlayerInventoryItem(prisma, { userId: "u1", itemCode: "shirt", quantity: 1, requestId: "00000000-0000-4000-8000-000000000002" })).rejects.toThrow("ITEM_NOT_USABLE");
  });

  it("does not consume when inventory quantity is insufficient", async () => {
    const { prisma, tx } = setup();
    tx.playerInventoryItem.findUnique.mockResolvedValueOnce({ id: "i1", quantity: 0 });
    await expect(usePlayerInventoryItem(prisma, { userId: "u1", itemCode: "water", quantity: 1, requestId: "00000000-0000-4000-8000-000000000003" })).rejects.toThrow("INSUFFICIENT_ITEM_QUANTITY");
    expect(tx.playerProfile.update).not.toHaveBeenCalled();
  });
});
