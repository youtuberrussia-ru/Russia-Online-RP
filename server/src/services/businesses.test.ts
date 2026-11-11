import { describe, expect, it, vi } from "vitest";
import { businessCatalog, getBusinessCatalog, purchasePlayerBusiness } from "./businesses.js";

describe("business catalogue", () => {
  it("has unique codes, positive prices and multiple business types", () => {
    const codes = businessCatalog.map(item => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(businessCatalog.every(item => item.price > 0n)).toBe(true);
    expect(new Set(businessCatalog.map(item => item.type)).size).toBeGreaterThanOrEqual(5);
  });

  it("shows whether each business is available", async () => {
    const prisma = { business: { findMany: vi.fn().mockResolvedValue([{ businessCode: "cafe_01", status: "ACTIVE" }]) } } as any;
    const result = await getBusinessCatalog(prisma);
    expect(result.find(item => item.code === "cafe_01")?.available).toBe(false);
    expect(result.find(item => item.code === "grocery_01")?.available).toBe(true);
    expect(result.every(item => typeof item.price === "string")).toBe(true);
  });
});

describe("business purchase", () => {
  it("rejects invalid request IDs and unknown catalogue entries before opening a transaction", async () => {
    const prisma = { $transaction: vi.fn() } as any;
    await expect(purchasePlayerBusiness(prisma, { userId: "u1", businessCode: "unknown", requestId: "00000000-0000-0000-8000-000000000000" })).rejects.toThrow("BUSINESS_NOT_FOUND");
    await expect(purchasePlayerBusiness(prisma, { userId: "u1", businessCode: "cafe_01", requestId: "bad" })).rejects.toThrow("INVALID_REQUEST_ID");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not charge when the wallet balance is insufficient", async () => {
    const tx = {
      business: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      playerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "p1" }) },
      wallet: { findUnique: vi.fn().mockResolvedValue({ id: "w1", balance: 100n }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      economyTransaction: { create: vi.fn() }
    };
    const prisma = { $transaction: (fn: any) => fn(tx) } as any;
    await expect(purchasePlayerBusiness(prisma, { userId: "u1", businessCode: "cafe_01", requestId: "00000000-0000-4000-8000-000000000000" })).rejects.toThrow("INSUFFICIENT_FUNDS");
    expect(tx.economyTransaction.create).not.toHaveBeenCalled();
    expect(tx.business.create).not.toHaveBeenCalled();
  });
});
