import type { PrismaClient } from "@prisma/client";

export async function applyWalletChange(
  prisma: PrismaClient,
  input: { userId: string; amount: bigint; reason: string; idempotencyKey: string }
) {
  if (input.amount === 0n) throw new Error("Zero-value transactions are not allowed.");
  if (input.reason.trim().length < 3) throw new Error("A transaction reason is required.");
  if (input.idempotencyKey.trim().length < 8 || input.idempotencyKey.length > 180) {
    throw new Error("A valid idempotency key is required.");
  }

  return prisma.$transaction(async tx => {
    const prior = await tx.economyTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { wallet: { select: { userId: true } } }
    });
    if (prior) {
      if (
        prior.wallet.userId !== input.userId ||
        prior.amount !== input.amount ||
        prior.reason !== input.reason
      ) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return prior;
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: input.userId } });
    if (!wallet) throw new Error("Wallet not found.");

    const where = input.amount < 0n
      ? { id: wallet.id, balance: { gte: -input.amount } }
      : { id: wallet.id };
    const changed = await tx.wallet.updateMany({
      where,
      data: { balance: { increment: input.amount } }
    });
    if (changed.count !== 1) throw new Error("Insufficient funds.");

    const updated = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    return tx.economyTransaction.create({
      data: {
        walletId: wallet.id,
        amount: input.amount,
        balanceAfter: updated.balance,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey
      }
    });
  }, { isolationLevel: "Serializable" });
}
