import type { PrismaClient } from "@prisma/client";

const consumables: Record<string, { hunger: number; thirst: number; energy: number }> = {
  water: { hunger: 0, thirst: 35, energy: 0 },
  bread: { hunger: 25, thirst: -5, energy: 0 },
  milk: { hunger: 10, thirst: 15, energy: 0 },
  coffee: { hunger: 0, thirst: -10, energy: 20 },
  sandwich: { hunger: 35, thirst: -5, energy: 5 }
};

export async function usePlayerInventoryItem(prisma: PrismaClient, input: {
  userId: string; itemCode: string; quantity: number; requestId: string;
}) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 10) throw new Error("INVALID_QUANTITY");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) throw new Error("INVALID_REQUEST_ID");
  const effect = consumables[input.itemCode];
  if (!effect) throw new Error("ITEM_NOT_USABLE");
  const key = `inventory-use:${input.userId}:${input.requestId}`;
  return prisma.$transaction(async tx => {
    const previous = await tx.economyTransaction.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    if (previous) return { alreadyUsed: true };
    const profile = await tx.playerProfile.findUnique({ where: { userId: input.userId }, select: { id: true, hunger: true, thirst: true, energy: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const item = await tx.playerInventoryItem.findUnique({ where: { profileId_itemCode: { profileId: profile.id, itemCode: input.itemCode } } });
    if (!item || item.quantity < input.quantity) throw new Error("INSUFFICIENT_ITEM_QUANTITY");
    const consumed = await tx.playerInventoryItem.updateMany({
      where: { id: item.id, quantity: { gte: input.quantity } },
      data: { quantity: { decrement: input.quantity } }
    });
    if (consumed.count !== 1) throw new Error("INSUFFICIENT_ITEM_QUANTITY");
    const clamp = (value: number) => Math.max(0, Math.min(100, value));
    const multiplier = input.quantity;
    const updated = await tx.playerProfile.update({
      where: { id: profile.id },
      data: {
        hunger: clamp(profile.hunger + effect.hunger * multiplier),
        thirst: clamp(profile.thirst + effect.thirst * multiplier),
        energy: clamp(profile.energy + effect.energy * multiplier)
      },
      select: { hunger: true, thirst: true, energy: true }
    });
    return { alreadyUsed: false, itemCode: input.itemCode, quantityUsed: input.quantity, inventoryQuantity: item.quantity - input.quantity, status: updated };
  }, { isolationLevel: "Serializable" });
}
