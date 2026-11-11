import type { PrismaClient } from "@prisma/client";
import { writeAudit } from "./audit.js";

type Db = PrismaClient;

async function getBusinessActor(tx: any, actorProfileId: string, businessId: string) {
  const business = await tx.business.findUnique({ where: { id: businessId }, select: { id: true, ownerProfileId: true, status: true } });
  if (!business || business.status !== "ACTIVE") throw new Error("BUSINESS_NOT_FOUND");
  if (business.ownerProfileId === actorProfileId) return { business, owner: true, employee: null };
  const employee = await tx.businessEmployee.findUnique({ where: { businessId_profileId: { businessId, profileId: actorProfileId } } });
  if (!employee || !employee.canManageStaff) throw new Error("BUSINESS_PERMISSION_DENIED");
  return { business, owner: false, employee };
}

export async function listBusinessEmployees(prisma: Db, actorProfileId: string, businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { id: true, ownerProfileId: true, status: true } });
  if (!business || business.status !== "ACTIVE") throw new Error("BUSINESS_NOT_FOUND");
  if (business.ownerProfileId !== actorProfileId) {
    const employee = await prisma.businessEmployee.findUnique({ where: { businessId_profileId: { businessId, profileId: actorProfileId } }, select: { canManageStaff: true } });
    if (!employee?.canManageStaff) throw new Error("BUSINESS_PERMISSION_DENIED");
  }
  return prisma.businessEmployee.findMany({
    where: { businessId }, orderBy: { hiredAt: "asc" },
    select: { id: true, jobTitle: true, canManageStaff: true, canManageStock: true, canManageCash: true, hiredAt: true, updatedAt: true, profile: { select: { id: true, nickname: true, level: true } } }
  });
}

export async function hireBusinessEmployee(prisma: Db, input: { actorUserId: string; actorProfileId: string; businessId: string; nickname: string; jobTitle: string }) {
  return prisma.$transaction(async tx => {
    const { business, owner } = await getBusinessActor(tx, input.actorProfileId, input.businessId);
    const target = await tx.playerProfile.findUnique({ where: { nickname: input.nickname }, select: { id: true, nickname: true } });
    if (!target) throw new Error("PLAYER_NOT_FOUND");
    if (target.id === business.ownerProfileId || target.id === input.actorProfileId) throw new Error("CANNOT_HIRE_SELF_OR_OWNER");
    const existing = await tx.businessEmployee.findUnique({ where: { businessId_profileId: { businessId: input.businessId, profileId: target.id } } });
    if (existing) throw new Error("EMPLOYEE_ALREADY_HIRED");
    const employee = await tx.businessEmployee.create({ data: { businessId: input.businessId, profileId: target.id, jobTitle: input.jobTitle } });
    await writeAudit(tx, { actorId: input.actorUserId, action: "BUSINESS_EMPLOYEE_HIRED", targetType: "BUSINESS", targetId: business.id, reason: "Найм сотрудника", metadata: { employeeId: employee.id, nickname: target.nickname, jobTitle: input.jobTitle, delegated: !owner } });
    return { id: employee.id, nickname: target.nickname, jobTitle: employee.jobTitle, canManageStaff: employee.canManageStaff, canManageStock: employee.canManageStock, canManageCash: employee.canManageCash, hiredAt: employee.hiredAt };
  }, { isolationLevel: "Serializable" });
}

export async function updateBusinessEmployee(prisma: Db, input: { actorUserId: string; actorProfileId: string; businessId: string; employeeId: string; jobTitle: string; canManageStaff: boolean; canManageStock: boolean; canManageCash: boolean }) {
  return prisma.$transaction(async tx => {
    const business = await tx.business.findFirst({ where: { id: input.businessId, ownerProfileId: input.actorProfileId, status: "ACTIVE" }, select: { id: true } });
    if (!business) throw new Error("BUSINESS_OWNER_REQUIRED");
    const existing = await tx.businessEmployee.findFirst({ where: { id: input.employeeId, businessId: input.businessId }, select: { id: true, profile: { select: { nickname: true } } } });
    if (!existing) throw new Error("EMPLOYEE_NOT_FOUND");
    const employee = await tx.businessEmployee.update({ where: { id: existing.id }, data: { jobTitle: input.jobTitle, canManageStaff: input.canManageStaff, canManageStock: input.canManageStock, canManageCash: input.canManageCash } });
    await writeAudit(tx, { actorId: input.actorUserId, action: "BUSINESS_EMPLOYEE_PERMISSIONS_UPDATED", targetType: "BUSINESS", targetId: business.id, reason: "Изменение должности и прав сотрудника", metadata: { employeeId: employee.id, nickname: existing.profile.nickname, jobTitle: input.jobTitle, canManageStaff: input.canManageStaff, canManageStock: input.canManageStock, canManageCash: input.canManageCash } });
    return { id: employee.id, nickname: existing.profile.nickname, jobTitle: employee.jobTitle, canManageStaff: employee.canManageStaff, canManageStock: employee.canManageStock, canManageCash: employee.canManageCash, updatedAt: employee.updatedAt };
  }, { isolationLevel: "Serializable" });
}

export async function dismissBusinessEmployee(prisma: Db, input: { actorUserId: string; actorProfileId: string; businessId: string; employeeId: string }) {
  return prisma.$transaction(async tx => {
    const { business, owner } = await getBusinessActor(tx, input.actorProfileId, input.businessId);
    const employee = await tx.businessEmployee.findFirst({ where: { id: input.employeeId, businessId: input.businessId }, select: { id: true, profileId: true, canManageStaff: true, canManageStock: true, canManageCash: true, profile: { select: { nickname: true } } } });
    if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
    if (!owner && (employee.canManageStaff || employee.canManageStock || employee.canManageCash)) throw new Error("OWNER_REQUIRED_TO_DISMISS_PRIVILEGED_EMPLOYEE");
    await tx.businessEmployee.delete({ where: { id: employee.id } });
    await writeAudit(tx, { actorId: input.actorUserId, action: "BUSINESS_EMPLOYEE_DISMISSED", targetType: "BUSINESS", targetId: business.id, reason: "Увольнение сотрудника", metadata: { employeeId: employee.id, nickname: employee.profile.nickname, delegated: !owner } });
    return { dismissed: true, employeeId: employee.id, nickname: employee.profile.nickname };
  }, { isolationLevel: "Serializable" });
}
