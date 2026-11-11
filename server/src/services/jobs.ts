import type { PrismaClient } from "@prisma/client";

export const JOBS = [
  { code: "TAXI", title: "Таксист", description: "Перевозите пассажиров по городу", hourlyRate: 1800n },
  { code: "BUS", title: "Водитель автобуса", description: "Работайте на городских маршрутах", hourlyRate: 2100n },
  { code: "DELIVERY", title: "Курьер", description: "Доставляйте посылки и заказы", hourlyRate: 2000n },
  { code: "TRUCKER", title: "Дальнобойщик", description: "Перевозите грузы между районами", hourlyRate: 2600n },
  { code: "MECHANIC", title: "Механик", description: "Помогайте обслуживать транспорт", hourlyRate: 2400n },
  { code: "FARMER", title: "Фермер", description: "Работайте на сельскохозяйственных угодьях", hourlyRate: 1700n },
  { code: "FISHERMAN", title: "Рыбак", description: "Занимайтесь рыболовным промыслом", hourlyRate: 1600n },
  { code: "CLEANER", title: "Работник коммунальной службы", description: "Поддерживайте чистоту городских улиц", hourlyRate: 1500n }
] as const;

const MIN_SHIFT_MS = 10 * 60 * 1000;
const MAX_PAID_SHIFT_MS = 120 * 60 * 1000;
const DAILY_CAP = 25_000n;

export function calculateJobPayout(hourlyRate: bigint, elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_SHIFT_MS) {
    throw new Error("SHIFT_TOO_SHORT");
  }
  const paidMs = Math.min(elapsedMs, MAX_PAID_SHIFT_MS);
  return hourlyRate * BigInt(Math.floor(paidMs / 60_000)) / 60n;
}

export async function startJobShift(prisma: PrismaClient, userId: string, jobCode: string, now = new Date()) {
  const job = JOBS.find(item => item.code === jobCode);
  if (!job) throw new Error("JOB_NOT_FOUND");
  return prisma.$transaction(async tx => {
    const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const active = await tx.jobShift.findFirst({ where: { profileId: profile.id, status: "ACTIVE" } });
    if (active) throw new Error("JOB_SHIFT_ALREADY_ACTIVE");
    const shift = await tx.jobShift.create({ data: { profileId: profile.id, jobCode: job.code, startedAt: now } });
    return { id: shift.id, jobCode: shift.jobCode, title: job.title, startedAt: shift.startedAt };
  }, { isolationLevel: "Serializable" });
}

export async function finishJobShift(prisma: PrismaClient, userId: string, shiftId: string, requestId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("INVALID_REQUEST_ID");
  return prisma.$transaction(async tx => {
    const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const shift = await tx.jobShift.findFirst({ where: { id: shiftId, profileId: profile.id } });
    if (!shift) throw new Error("JOB_SHIFT_NOT_FOUND");
    if (shift.status === "COMPLETED") {
      return { completed: true, alreadyCompleted: true, payout: shift.payout.toString(), endedAt: shift.endedAt };
    }
    if (shift.status !== "ACTIVE") throw new Error("JOB_SHIFT_NOT_ACTIVE");
    const job = JOBS.find(item => item.code === shift.jobCode);
    if (!job) throw new Error("JOB_NOT_FOUND");
    const elapsedMs = now.getTime() - shift.startedAt.getTime();
    const calculated = calculateJobPayout(job.hourlyRate, elapsedMs);
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const earned = await tx.jobShift.aggregate({
      where: { profileId: profile.id, status: "COMPLETED", endedAt: { gte: dayStart } },
      _sum: { payout: true }
    });
    const remaining = DAILY_CAP - (earned._sum.payout ?? 0n);
    const payout = calculated < remaining ? calculated : remaining;
    if (payout <= 0n) throw new Error("DAILY_JOB_LIMIT_REACHED");
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new Error("WALLET_NOT_FOUND");
    const balance = wallet.balance + payout;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance } });
    await tx.economyTransaction.create({
      data: {
        walletId: wallet.id,
        amount: payout,
        balanceAfter: balance,
        reason: `Зарплата: ${job.title}`,
        idempotencyKey: `job-shift:${shift.id}`
      }
    });
    const updated = await tx.jobShift.update({
      where: { id: shift.id },
      data: { status: "COMPLETED", endedAt: now, payout, finishKey: requestId }
    });
    return { completed: true, alreadyCompleted: false, payout: payout.toString(), balance: balance.toString(), endedAt: updated.endedAt };
  }, { isolationLevel: "Serializable" });
}

export async function cancelJobShift(prisma: PrismaClient, userId: string, shiftId: string) {
  return prisma.$transaction(async tx => {
    const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const shift = await tx.jobShift.findFirst({ where: { id: shiftId, profileId: profile.id, status: "ACTIVE" } });
    if (!shift) throw new Error("ACTIVE_JOB_SHIFT_NOT_FOUND");
    await tx.jobShift.update({ where: { id: shift.id }, data: { status: "CANCELLED", endedAt: new Date() } });
    return { cancelled: true, id: shift.id };
  }, { isolationLevel: "Serializable" });
}
