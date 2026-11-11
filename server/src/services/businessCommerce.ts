import type { PrismaClient } from "@prisma/client";

const products = [
  { code: "water", name: "Вода", cost: 12n, price: 20n, types: ["GROCERY", "CAFE", "HOTEL"] },
  { code: "bread", name: "Хлеб", cost: 18n, price: 30n, types: ["GROCERY", "CAFE"] },
  { code: "milk", name: "Молоко", cost: 28n, price: 42n, types: ["GROCERY", "CAFE"] },
  { code: "coffee", name: "Кофе", cost: 35n, price: 60n, types: ["CAFE", "HOTEL"] },
  { code: "sandwich", name: "Сэндвич", cost: 55n, price: 85n, types: ["GROCERY", "CAFE", "HOTEL"] },
  { code: "shirt", name: "Футболка", cost: 140n, price: 220n, types: ["RETAIL"] },
  { code: "fuel_can", name: "Канистра топлива", cost: 90n, price: 135n, types: ["FUEL"] }
] as const;

export function getBusinessProductCatalog(businessType?: string) {
  return products.filter(item => !businessType || item.types.includes(businessType as never)).map(item => ({
    code: item.code, name: item.name, restockPrice: item.cost.toString(), salePrice: item.price.toString()
  }));
}

function parseQuantity(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) throw new Error("INVALID_QUANTITY");
  return value;
}

function assertRequestId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("INVALID_REQUEST_ID");
}

async function assertBusinessPermission(tx: any, actorProfileId: string, businessId: string, permission: "canManageStock" | "canManageCash") {
  const business = await tx.business.findUnique({ where: { id: businessId }, select: { id: true, ownerProfileId: true, businessType: true, status: true, cashBalance: true } });
  if (!business || business.status !== "ACTIVE") throw new Error("BUSINESS_NOT_FOUND");
  if (business.ownerProfileId === actorProfileId) return business;
  const employee = await tx.businessEmployee.findUnique({ where: { businessId_profileId: { businessId, profileId: actorProfileId } }, select: { canManageStock: true, canManageCash: true } });
  if (!employee?.canManageStock || (permission === "canManageCash" && !employee.canManageCash)) throw new Error("BUSINESS_PERMISSION_DENIED");
  return business;
}

export async function listBusinessStock(prisma: PrismaClient, actorProfileId: string, businessId: string) {
  const business = await assertBusinessPermission(prisma, actorProfileId, businessId, "canManageStock");
  const stock = await prisma.businessStockItem.findMany({ where: { businessId }, orderBy: { productCode: "asc" }, select: { productCode: true, quantity: true, updatedAt: true } });
  const catalog = getBusinessProductCatalog(business.businessType);
  return catalog.map(product => ({ ...product, quantity: stock.find(item => item.productCode === product.code)?.quantity ?? 0 }));
}

export async function restockBusiness(prisma: PrismaClient, input: { actorUserId: string; actorProfileId: string; businessId: string; productCode: string; quantity: number; requestId: string }) {
  const quantity = parseQuantity(input.quantity);
  assertRequestId(input.requestId);
  const product = products.find(item => item.code === input.productCode);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const total = product.cost * BigInt(quantity);
  const key = "business-restock:" + input.businessId + ":" + input.actorUserId + ":" + input.requestId;
  return prisma.$transaction(async tx => {
    const previous = await tx.businessLedger.findUnique({ where: { idempotencyKey: key } });
    if (previous) return { alreadyProcessed: true, balance: previous.balanceAfter.toString() };
    const business = await assertBusinessPermission(tx, input.actorProfileId, input.businessId, "canManageCash");
    if (!product.types.includes(business.businessType as never)) throw new Error("PRODUCT_NOT_AVAILABLE_FOR_BUSINESS");
    const debit = await tx.business.updateMany({ where: { id: business.id, status: "ACTIVE", cashBalance: { gte: total } }, data: { cashBalance: { decrement: total } } });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_BUSINESS_FUNDS");
    const updated = await tx.business.findUniqueOrThrow({ where: { id: business.id }, select: { cashBalance: true } });
    const stock = await tx.businessStockItem.upsert({
      where: { businessId_productCode: { businessId: business.id, productCode: product.code } },
      create: { businessId: business.id, productCode: product.code, quantity },
      update: { quantity: { increment: quantity } }
    });
    await tx.businessLedger.create({ data: { businessId: business.id, kind: "RESTOCK", amount: -total, balanceAfter: updated.cashBalance, reason: "Закупка товара: " + product.name + " × " + quantity, idempotencyKey: key } });
    return { alreadyProcessed: false, productCode: product.code, quantityAdded: quantity, stockQuantity: stock.quantity, businessCashBalance: updated.cashBalance.toString() };
  }, { isolationLevel: "Serializable" });
}

export async function purchaseBusinessProduct(prisma: PrismaClient, input: { userId: string; productBusinessId: string; productCode: string; quantity: number; requestId: string }) {
  const quantity = parseQuantity(input.quantity);
  assertRequestId(input.requestId);
  const product = products.find(item => item.code === input.productCode);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const total = product.price * BigInt(quantity);
  const key = "business-sale:" + input.userId + ":" + input.requestId;
  return prisma.$transaction(async tx => {
    const previous = await tx.businessSale.findUnique({ where: { idempotencyKey: key } });
    if (previous) {
      if (previous.businessId !== input.productBusinessId || previous.productCode !== product.code || previous.quantity !== quantity) throw new Error("IDEMPOTENCY_KEY_REUSED");
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return { alreadyPurchased: true, saleId: previous.id, walletBalance: wallet?.balance.toString() ?? null };
    }
    const profile = await tx.playerProfile.findUnique({ where: { userId: input.userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const business = await tx.business.findUnique({ where: { id: input.productBusinessId }, select: { id: true, businessType: true, status: true } });
    if (!business || business.status !== "ACTIVE") throw new Error("BUSINESS_NOT_FOUND");
    if (!product.types.includes(business.businessType as never)) throw new Error("PRODUCT_NOT_AVAILABLE_FOR_BUSINESS");
    const stock = await tx.businessStockItem.updateMany({ where: { businessId: business.id, productCode: product.code, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } });
    if (stock.count !== 1) throw new Error("INSUFFICIENT_STOCK");
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    const debit = await tx.wallet.updateMany({ where: { id: wallet.id, balance: { gte: total } }, data: { balance: { decrement: total } } });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balance: true } });
    const updatedBusiness = await tx.business.update({ where: { id: business.id }, data: { cashBalance: { increment: total } }, select: { cashBalance: true } });
    const sale = await tx.businessSale.create({ data: { businessId: business.id, buyerProfileId: profile.id, productCode: product.code, quantity, totalAmount: total, idempotencyKey: key } });
    const inventoryItem = await tx.playerInventoryItem.upsert({
      where: { profileId_itemCode: { profileId: profile.id, itemCode: product.code } },
      create: { profileId: profile.id, itemCode: product.code, quantity },
      update: { quantity: { increment: quantity } },
      select: { quantity: true }
    });
    await tx.economyTransaction.create({ data: { walletId: wallet.id, amount: -total, balanceAfter: updatedWallet.balance, reason: "Покупка в бизнесе: " + product.name + " × " + quantity, idempotencyKey: key } });
    await tx.businessLedger.create({ data: { businessId: business.id, kind: "SALE", amount: total, balanceAfter: updatedBusiness.cashBalance, reason: "Продажа товара: " + product.name + " × " + quantity, idempotencyKey: "business-ledger:" + key } });
    return { alreadyPurchased: false, saleId: sale.id, productName: product.name, quantity, inventoryQuantity: inventoryItem.quantity, total: total.toString(), walletBalance: updatedWallet.balance.toString(), businessCashBalance: updatedBusiness.cashBalance.toString() };
  }, { isolationLevel: "Serializable" });
}


export async function listPlayerInventory(prisma: PrismaClient, userId: string) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new Error("PROFILE_NOT_FOUND");
  const items = await prisma.playerInventoryItem.findMany({
    where: { profileId: profile.id, quantity: { gt: 0 } },
    orderBy: { itemCode: "asc" },
    select: { itemCode: true, quantity: true, updatedAt: true }
  });
  const catalog = new Map(products.map(item => [item.code, item.name]));
  return items.map(item => ({
    code: item.itemCode,
    name: catalog.get(item.itemCode) ?? "Неизвестный предмет",
    quantity: item.quantity,
    updatedAt: item.updatedAt
  }));
}
