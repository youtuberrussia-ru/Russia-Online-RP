export const propertyCatalog = [
  { code: "room_01", name: "Комната «Старт»", type: "ROOM", price: 25000n, description: "Небольшое первое жильё для одного игрока." },
  { code: "flat_01", name: "Квартира «Север»", type: "APARTMENT", price: 85000n, description: "Уютная городская квартира." },
  { code: "flat_02", name: "Квартира «Панорама»", type: "APARTMENT", price: 145000n, description: "Просторная квартира в современном доме." },
  { code: "house_01", name: "Дом «Берёзовый»", type: "HOUSE", price: 320000n, description: "Отдельный дом за городом." },
  { code: "house_02", name: "Дом «Прибрежный»", type: "HOUSE", price: 520000n, description: "Большой загородный дом." }
] as const;

export function getPropertyCatalog() {
  return propertyCatalog.map(({ price, ...item }) => ({ ...item, price: price.toString() }));
}

export async function purchasePlayerProperty(
  prisma: import("@prisma/client").PrismaClient,
  input: { userId: string; propertyCode: string; requestId: string }
) {
  const item = propertyCatalog.find(property => property.code === input.propertyCode);
  if (!item) throw new Error("PROPERTY_NOT_FOUND");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    throw new Error("INVALID_REQUEST_ID");
  }
  const purchaseKey = "property-purchase:" + input.userId + ":" + input.requestId;
  return prisma.$transaction(async tx => {
    const previous = await tx.playerProperty.findUnique({ where: { purchaseKey } });
    if (previous) {
      if (previous.propertyCode !== item.code) throw new Error("IDEMPOTENCY_KEY_REUSED");
      const wallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return { property: previous, balance: wallet?.balance.toString() ?? null, alreadyPurchased: true };
    }
    const profile = await tx.playerProfile.findUnique({ where: { userId: input.userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const existing = await tx.playerProperty.findUnique({
      where: { profileId_propertyCode: { profileId: profile.id, propertyCode: item.code } }
    });
    if (existing) throw new Error("PROPERTY_ALREADY_OWNED");
    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    const debit = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: item.price } },
      data: { balance: { decrement: item.price } }
    });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_FUNDS");
    const updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    await tx.economyTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -item.price,
        balanceAfter: updatedWallet.balance,
        reason: "Покупка недвижимости: " + item.name,
        idempotencyKey: purchaseKey
      }
    });
    const property = await tx.playerProperty.create({
      data: {
        profileId: profile.id,
        propertyCode: item.code,
        displayName: item.name,
        propertyType: item.type,
        purchaseKey,
        purchasedPrice: item.price
      }
    });
    return { property, balance: updatedWallet.balance.toString(), alreadyPurchased: false };
  }, { isolationLevel: "Serializable" });
}
