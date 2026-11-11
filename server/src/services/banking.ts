import type { PrismaClient } from "@prisma/client";

const MAX_OPERATION = 1_000_000_000n;
export function parseBankAmount(value: string) {
  if (!/^[1-9][0-9]{0,11}$/.test(value)) throw new Error("INVALID_AMOUNT");
  const amount = BigInt(value);
  if (amount > MAX_OPERATION) throw new Error("AMOUNT_TOO_LARGE");
  return amount;
}
export function assertBankRequestId(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("INVALID_REQUEST_ID");
  }
}

export async function getBankAccount(prisma: PrismaClient, userId: string) {
  const account = await prisma.bankAccount.upsert({ where: { userId }, update: {}, create: { userId } });
  return { balance: account.balance.toString(), createdAt: account.createdAt };
}

export async function depositToBank(prisma: PrismaClient, userId: string, amountText: string, requestId: string) {
  const amount = parseBankAmount(amountText);
  assertBankRequestId(requestId);
  return prisma.$transaction(async tx => {
    const key = `bank-deposit:${requestId}`;
    const prior = await tx.bankTransaction.findUnique({ where: { idempotencyKey: key } });
    const account = await tx.bankAccount.upsert({ where: { userId }, update: {}, create: { userId } });
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    if (prior) {
      if (prior.accountId !== account.id || prior.amount !== amount) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return { deposited: false, amount: amount.toString(), bankBalance: account.balance.toString(), walletBalance: wallet.balance.toString() };
    }
    const debit = await tx.wallet.updateMany({ where: { id: wallet.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_CASH");
    const bank = await tx.bankAccount.update({ where: { id: account.id }, data: { balance: { increment: amount } } });
    const cash = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    await tx.economyTransaction.create({ data: { walletId: wallet.id, amount: -amount, balanceAfter: cash.balance, reason: "Внесение в банк", idempotencyKey: key } });
    await tx.bankTransaction.create({ data: { accountId: account.id, amount, balanceAfter: bank.balance, reason: "Пополнение счёта", idempotencyKey: key } });
    return { deposited: true, amount: amount.toString(), bankBalance: bank.balance.toString(), walletBalance: cash.balance.toString() };
  }, { isolationLevel: "Serializable" });
}

export async function withdrawFromBank(prisma: PrismaClient, userId: string, amountText: string, requestId: string) {
  const amount = parseAmount(amountText);
  assertRequestId(requestId);
  return prisma.$transaction(async tx => {
    const key = `bank-withdraw:${requestId}`;
    const prior = await tx.bankTransaction.findUnique({ where: { idempotencyKey: key } });
    const account = await tx.bankAccount.upsert({ where: { userId }, update: {}, create: { userId } });
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    if (prior) {
      if (prior.accountId !== account.id || prior.amount !== -amount) throw new Error("IDEMPOTENCY_KEY_REUSED");
      return { withdrawn: false, amount: amount.toString(), bankBalance: account.balance.toString(), walletBalance: wallet.balance.toString() };
    }
    const debit = await tx.bankAccount.updateMany({ where: { id: account.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_BANK_FUNDS");
    const bank = await tx.bankAccount.findUniqueOrThrow({ where: { id: account.id } });
    const cash = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
    await tx.bankTransaction.create({ data: { accountId: account.id, amount: -amount, balanceAfter: bank.balance, reason: "Снятие наличных", idempotencyKey: key } });
    await tx.economyTransaction.create({ data: { walletId: wallet.id, amount, balanceAfter: cash.balance, reason: "Снятие из банка", idempotencyKey: key } });
    return { withdrawn: true, amount: amount.toString(), bankBalance: bank.balance.toString(), walletBalance: cash.balance.toString() };
  }, { isolationLevel: "Serializable" });
}

export async function transferBankFunds(prisma: PrismaClient, userId: string, recipientNickname: string, amountText: string, requestId: string) {
  const amount = parseAmount(amountText);
  assertRequestId(requestId);
  const nickname = recipientNickname.trim();
  if (nickname.length < 3 || nickname.length > 20) throw new Error("INVALID_RECIPIENT");
  return prisma.$transaction(async tx => {
    const recipient = await tx.playerProfile.findUnique({ where: { nickname }, select: { userId: true } });
    if (!recipient) throw new Error("RECIPIENT_NOT_FOUND");
    if (recipient.userId === userId) throw new Error("SELF_TRANSFER_NOT_ALLOWED");
    const from = await tx.bankAccount.upsert({ where: { userId }, update: {}, create: { userId } });
    const to = await tx.bankAccount.upsert({ where: { userId: recipient.userId }, update: {}, create: { userId: recipient.userId } });
    const prior = await tx.bankTransfer.findUnique({ where: { requestKey: requestId } });
    if (prior) {
      if (prior.fromAccountId !== from.id || prior.toAccountId !== to.id || prior.amount !== amount) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      const [sender, receiver] = await Promise.all([
        tx.bankAccount.findUniqueOrThrow({ where: { id: from.id } }),
        tx.bankAccount.findUniqueOrThrow({ where: { id: to.id } })
      ]);
      return { transferred: false, amount: amount.toString(), senderBalance: sender.balance.toString(), recipientBalance: receiver.balance.toString() };
    }
    const debit = await tx.bankAccount.updateMany({ where: { id: from.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } });
    if (debit.count !== 1) throw new Error("INSUFFICIENT_BANK_FUNDS");
    await tx.bankAccount.update({ where: { id: to.id }, data: { balance: { increment: amount } } });
    const [sender, receiver] = await Promise.all([
      tx.bankAccount.findUniqueOrThrow({ where: { id: from.id } }),
      tx.bankAccount.findUniqueOrThrow({ where: { id: to.id } })
    ]);
    await tx.bankTransfer.create({ data: { requestKey: requestId, fromAccountId: from.id, toAccountId: to.id, amount } });
    await tx.bankTransaction.createMany({ data: [
      { accountId: from.id, amount: -amount, balanceAfter: sender.balance, reason: `Перевод игроку ${nickname}`, idempotencyKey: `bank-transfer:${requestId}:debit` },
      { accountId: to.id, amount, balanceAfter: receiver.balance, reason: "Входящий перевод", idempotencyKey: `bank-transfer:${requestId}:credit` }
    ] });
    return { transferred: true, amount: amount.toString(), senderBalance: sender.balance.toString(), recipientBalance: receiver.balance.toString() };
  }, { isolationLevel: "Serializable" });
}
