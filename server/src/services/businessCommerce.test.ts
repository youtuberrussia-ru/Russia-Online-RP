import { describe, expect, it, vi } from "vitest";
import { getBusinessProductCatalog, listBusinessStock, purchaseBusinessProduct, restockBusiness } from "./businessCommerce.js";

function restockDb() {
  const tx = {
    businessLedger: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    business: { findUnique: vi.fn().mockResolvedValue({ id: "b1", ownerProfileId: "owner", businessType: "GROCERY", status: "ACTIVE", cashBalance: 10000n }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ cashBalance: 9940n }) },
    businessEmployee: { findUnique: vi.fn().mockResolvedValue(null) },
    businessStockItem: { upsert: vi.fn().mockResolvedValue({ quantity: 5 }) }
  };
  return { tx, prisma: { ...tx, $transaction: (fn: any) => fn(tx) } as any };
}

function saleDb() {
  const tx = {
    businessSale: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "sale1" }) },
    playerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "buyer1" }) },
    business: { findUnique: vi.fn().mockResolvedValue({ id: "b1", businessType: "GROCERY", status: "ACTIVE" }), update: vi.fn().mockResolvedValue({ cashBalance: 10020n }) },
    businessStockItem: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    wallet: { findUnique: vi.fn().mockResolvedValue({ id: "w1", balance: 500n }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ balance: 480n }) },
    economyTransaction: { create: vi.fn().mockResolvedValue({}) },
    businessLedger: { create: vi.fn().mockResolvedValue({}) },
    playerInventoryItem: { upsert: vi.fn().mockResolvedValue({ quantity: 1 }) }
  };
  return { tx, prisma: { ...tx, $transaction: (fn: any) => fn(tx) } as any };
}

describe("business commerce", () => {
  it("provides only products compatible with the selected business type", () => {
    expect(getBusinessProductCatalog("GROCERY").map(x => x.code)).toContain("bread");
    expect(getBusinessProductCatalog("GROCERY").map(x => x.code)).not.toContain("shirt");
  });

  it("lists inventory with zero quantities for not-yet-stocked products", async () => {
    const { prisma } = restockDb();
    prisma.businessStockItem.findMany = vi.fn().mockResolvedValue([{ productCode: "water", quantity: 7, updatedAt: new Date(0) }]);
    const rows = await listBusinessStock(prisma, "owner", "b1");
    expect(rows.find(x => x.code === "water")?.quantity).toBe(7);
    expect(rows.find(x => x.code === "bread")?.quantity).toBe(0);
  });

  it("charges the business cash balance and increases stock atomically", async () => {
    const { prisma, tx } = restockDb();
    const result = await restockBusiness(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", productCode: "water", quantity: 5, requestId: "00000000-0000-4000-8000-000000000000" });
    expect(tx.business.updateMany).toHaveBeenCalled();
    expect(tx.businessStockItem.upsert).toHaveBeenCalled();
    expect(tx.businessLedger.create).toHaveBeenCalled();
    expect(result.stockQuantity).toBe(5);
  });

  it("rejects an unauthorized employee and prevents restocking without business cash", async () => {
    const { prisma, tx } = restockDb();
    tx.business.findUnique.mockResolvedValueOnce({ id: "b1", ownerProfileId: "someone", businessType: "GROCERY", status: "ACTIVE", cashBalance: 10000n });
    tx.businessEmployee.findUnique.mockResolvedValueOnce({ canManageStock: true, canManageCash: false });
    await expect(restockBusiness(prisma, { actorUserId: "u2", actorProfileId: "staff", businessId: "b1", productCode: "water", quantity: 5, requestId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow("BUSINESS_PERMISSION_DENIED");
    tx.business.findUnique.mockResolvedValueOnce({ id: "b1", ownerProfileId: "owner", businessType: "GROCERY", status: "ACTIVE", cashBalance: 10000n });
    tx.business.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(restockBusiness(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", productCode: "water", quantity: 5, requestId: "00000000-0000-4000-8000-000000000001" })).rejects.toThrow("INSUFFICIENT_BUSINESS_FUNDS");
    expect(tx.businessStockItem.upsert).not.toHaveBeenCalled();
  });

  it("sells only available stock and writes both economy ledgers", async () => {
    const { prisma, tx } = saleDb();
    const result = await purchaseBusinessProduct(prisma, { userId: "u2", productBusinessId: "b1", productCode: "water", quantity: 1, requestId: "00000000-0000-4000-8000-000000000000" });
    expect(result.total).toBe("20");
    expect(tx.businessStockItem.updateMany).toHaveBeenCalled();
    expect(tx.wallet.updateMany).toHaveBeenCalled();
    expect(tx.economyTransaction.create).toHaveBeenCalled();
    expect(tx.businessLedger.create).toHaveBeenCalled();
    expect(tx.playerInventoryItem.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { profileId_itemCode: { profileId: "buyer1", itemCode: "water" } } }));
    expect(result.inventoryQuantity).toBe(1);
  });

  it("does not charge a player when stock is unavailable", async () => {
    const { prisma, tx } = saleDb();
    tx.businessStockItem.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(purchaseBusinessProduct(prisma, { userId: "u2", productBusinessId: "b1", productCode: "water", quantity: 1, requestId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it("rejects invalid quantities before opening a transaction", async () => {
    const prisma = { $transaction: vi.fn() } as any;
    await expect(purchaseBusinessProduct(prisma, { userId: "u2", productBusinessId: "b1", productCode: "water", quantity: 0, requestId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow("INVALID_QUANTITY");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
