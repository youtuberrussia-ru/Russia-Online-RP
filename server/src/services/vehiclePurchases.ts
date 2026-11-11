import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { vehicleCatalog } from "./vehicleCatalog.js";

export async function purchasePlayerVehicle(
  prisma: PrismaClient,
  input: { userId: string; vehicleCode: string; requestId: string }
) {
  const item = vehicleCatalog.find(vehicle => vehicle.code === input.vehicleCode);
  if (!item) throw new Error("VEHICLE_NOT_FOUND");
  const purchaseKey = "vehicle-purchase:" + input.userId + ":" + input.requestId;

  return prisma.$transaction(async tx => {
    const previous = await tx.playerVehicle.findUnique({ where: { purchaseKey } });
    if (previous) {
      if (previous.modelCode !== item.code) throw new Error("IDEMPOTENCY_KEY_REUSED");
      const currentWallet = await tx.wallet.findUnique({ where: { userId: input.userId }, select: { balance: true } });
      return { vehicle: previous, balance: currentWallet?.balance.toString() ?? null, alreadyPurchased: true };
    }

    const profile = await tx.playerProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true }
    });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");

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
        reason: "Покупка транспорта: " + item.name,
        idempotencyKey: purchaseKey
      }
    });

    const plate = "ROR-" + randomBytes(4).toString("hex").toUpperCase();
    const vehicle = await tx.playerVehicle.create({
      data: {
        profileId: profile.id,
        modelCode: item.code,
        displayName: item.name,
        plate,
        purchaseKey,
        purchasedPrice: item.price,
        status: "STORED"
      }
    });
    return { vehicle, balance: updatedWallet.balance.toString(), alreadyPurchased: false };
  }, { isolationLevel: "Serializable" });
}
