export const propertyCatalog = [
  { code: "room_01", name: "Комната «Старт»", type: "ROOM", price: 25000n, district: "Старый город", interiorCode: "room_basic", storageSlots: 5, parkingSlots: 0, description: "Небольшое первое жильё для одного игрока." },
  { code: "room_02", name: "Комната «Уют»", type: "ROOM", price: 39000n, district: "Северный район", interiorCode: "room_cozy", storageSlots: 8, parkingSlots: 0, description: "Обустроенная комната в спокойном районе." },
  { code: "flat_01", name: "Квартира «Север»", type: "APARTMENT", price: 85000n, district: "Северный район", interiorCode: "flat_small", storageSlots: 15, parkingSlots: 0, description: "Уютная городская квартира." },
  { code: "flat_02", name: "Квартира «Панорама»", type: "APARTMENT", price: 145000n, district: "Центр", interiorCode: "flat_modern", storageSlots: 25, parkingSlots: 0, description: "Просторная квартира в современном доме." },
  { code: "flat_03", name: "Квартира «Речной вид»", type: "APARTMENT", price: 185000n, district: "Набережная", interiorCode: "flat_river", storageSlots: 30, parkingSlots: 1, description: "Квартира с видом на реку и местом на парковке." },
  { code: "flat_04", name: "Пентхаус «Высота»", type: "PENTHOUSE", price: 460000n, district: "Деловой центр", interiorCode: "penthouse_lux", storageSlots: 55, parkingSlots: 2, description: "Большой пентхаус на верхнем этаже." },
  { code: "house_01", name: "Дом «Берёзовый»", type: "HOUSE", price: 320000n, district: "Пригород", interiorCode: "house_family", storageSlots: 45, parkingSlots: 2, description: "Отдельный дом за городом." },
  { code: "house_02", name: "Дом «Прибрежный»", type: "HOUSE", price: 520000n, district: "Прибрежный район", interiorCode: "house_coast", storageSlots: 65, parkingSlots: 3, description: "Большой загородный дом." },
  { code: "house_03", name: "Коттедж «Сосновый»", type: "COTTAGE", price: 690000n, district: "Сосновый бор", interiorCode: "cottage_pine", storageSlots: 80, parkingSlots: 3, description: "Просторный коттедж рядом с лесом." },
  { code: "house_04", name: "Особняк «Имперский»", type: "MANSION", price: 1250000n, district: "Элитный квартал", interiorCode: "mansion_classic", storageSlots: 120, parkingSlots: 5, description: "Большой особняк с просторным интерьером." },
  { code: "garage_01", name: "Гараж «Бокс»", type: "GARAGE", price: 55000n, district: "Промзона", interiorCode: "garage_single", storageSlots: 10, parkingSlots: 1, description: "Отдельный гараж для одного автомобиля." },
  { code: "garage_02", name: "Гараж «Автоклуб»", type: "GARAGE", price: 175000n, district: "Южный район", interiorCode: "garage_triple", storageSlots: 20, parkingSlots: 3, description: "Вместительный гараж на три автомобиля." },
  { code: "garage_03", name: "Автобокс «Профи»", type: "WORKSHOP", price: 290000n, district: "Промзона", interiorCode: "workshop_auto", storageSlots: 35, parkingSlots: 4, description: "Помещение с местом для хранения транспорта и оборудования." },
  { code: "shop_01", name: "Магазин «У дома»", type: "COMMERCIAL", price: 240000n, district: "Старый город", interiorCode: "shop_small", storageSlots: 40, parkingSlots: 1, description: "Небольшое коммерческое помещение. Управление бизнесом будет отдельной системой." },
  { code: "office_01", name: "Офис «Деловой»", type: "OFFICE", price: 410000n, district: "Деловой центр", interiorCode: "office_modern", storageSlots: 50, parkingSlots: 2, description: "Офисное помещение для будущих бизнес-механик." }
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
        district: item.district,
        interiorCode: item.interiorCode,
        storageSlots: item.storageSlots,
        parkingSlots: item.parkingSlots,
        purchaseKey,
        purchasedPrice: item.price
      }
    });
    return { property, balance: updatedWallet.balance.toString(), alreadyPurchased: false };
  }, { isolationLevel: "Serializable" });
}
