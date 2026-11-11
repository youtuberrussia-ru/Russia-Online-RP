export const businessCatalog = [
  { code: "grocery_01", name: "Продуктовый магазин «У дома»", type: "GROCERY", district: "Старый город", price: 180000n, description: "Небольшой магазин повседневных товаров." },
  { code: "cafe_01", name: "Кафе «Перекрёсток»", type: "CAFE", district: "Центр", price: 320000n, description: "Городское кафе с залом для посетителей." },
  { code: "service_01", name: "Автосервис «Гараж 24»", type: "SERVICE", district: "Промзона", price: 410000n, description: "Мастерская для обслуживания транспорта." },
  { code: "clothing_01", name: "Магазин одежды «Стиль»", type: "RETAIL", district: "Торговый квартал", price: 470000n, description: "Магазин одежды и аксессуаров." },
  { code: "fuel_01", name: "АЗС «Трасса»", type: "FUEL", district: "Южный выезд", price: 780000n, description: "Заправочная станция на выезде из города." },
  { code: "hotel_01", name: "Отель «Панорама»", type: "HOTEL", district: "Набережная", price: 1250000n, description: "Небольшой городской отель." }
] as const;

export async function getBusinessCatalog(prisma: import("@prisma/client").PrismaClient) {
  const owned = await prisma.business.findMany({ select: { businessCode: true, status: true } });
  const byCode = new Map(owned.map(item => [item.businessCode, item.status]));
  return businessCatalog.map(({ price, ...item }) => ({
    ...item,
    price: price.toString(),
    available: !byCode.has(item.code),
    status: byCode.get(item.code) ?? "FOR_SALE"
  }));
}

export async function getOwnedBusinesses(prisma: import("@prisma/client").PrismaClient, profileId: string) {
  const rows = await prisma.business.findMany({
    where: { ownerProfileId: profileId },
    orderBy: { createdAt: "desc" },
    select: { id: true, businessCode: true, displayName: true, businessType: true, district: true, purchasedPrice: true, cashBalance: true, status: true, createdAt: true, _count: { select: { employees: true } } }
  });
  return rows.map(row => ({ ...row, purchasedPrice: row.purchasedPrice.toString(), cashBalance: row.cashBalance.toString(), employeeCount: row._count.employees, _count: undefined }));
}

export async function purchasePlayerBusiness(
  prisma: import("@prisma/client").PrismaClient,
  input: { userId: string; businessCode: string; requestId: string }
) {
  const item = businessCatalog.find(business => business.code === input.businessCode);
  if (!item) throw new Error("BUSINESS_NOT_FOUND");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error("INVALID_REQUEST_ID");
  const purchaseKey = "business-purchase:" + input.userId + ":" + input.requestId;
  return prisma.$transaction(async tx => {
    const previous = await tx.business.findUnique({ where: { purchaseKey } });
    if (previous) {
      if (previous.businessCode !== item.code) throw new Error("IDEMPOTENCY_KEY_REUSED");
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return { business: previous, walletBalance: wallet?.balance.toString() ?? null, alreadyPurchased: true };
    }
    const profile = await tx.playerProfile.findUnique({ where: { userId: input.userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const alreadyOwned = await tx.business.findUnique({ where: { businessCode: item.code } });
    if (alreadyOwned) throw new Error("BUSINESS_ALREADY_OWNED");
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    const debit = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: item.price } },
      data: { balance: { decrement: item.price } }
    });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    await tx.economyTransaction.create({ data: {
      walletId: wallet.id, amount: -item.price, balanceAfter: updatedWallet.balance,
      reason: "Покупка бизнеса: " + item.name, idempotencyKey: purchaseKey
    }});
    const business = await tx.business.create({ data: {
      businessCode: item.code, displayName: item.name, businessType: item.type, district: item.district,
      ownerProfileId: profile.id, purchaseKey, purchasedPrice: item.price
    }});
    return { business, walletBalance: updatedWallet.balance.toString(), alreadyPurchased: false };
  }, { isolationLevel: "Serializable" });
}
