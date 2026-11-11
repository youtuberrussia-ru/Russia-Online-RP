import { describe, expect, it, vi } from "vitest";
import { dismissBusinessEmployee, hireBusinessEmployee, listBusinessEmployees, updateBusinessEmployee } from "./businessEmployees.js";

function setup() {
  const employee = { id: "e1", jobTitle: "Кассир", canManageStaff: false, canManageStock: false, canManageCash: false, hiredAt: new Date(0), updatedAt: new Date(0), profile: { id: "p2", nickname: "PlayerTwo", level: 3 } };
  const tx = {
    business: { findUnique: vi.fn().mockResolvedValue({ id: "b1", ownerProfileId: "owner", status: "ACTIVE" }), findFirst: vi.fn().mockResolvedValue({ id: "b1" }) },
    businessEmployee: {
      findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(employee),
      findMany: vi.fn().mockResolvedValue([employee]), create: vi.fn().mockResolvedValue(employee),
      update: vi.fn().mockResolvedValue({ ...employee, jobTitle: "Менеджер", canManageCash: true }),
      delete: vi.fn().mockResolvedValue(employee)
    },
    playerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "p2", nickname: "PlayerTwo" }) },
    adminAuditLog: { create: vi.fn().mockResolvedValue({ id: "audit1" }) }
  };
  const prisma = { ...tx, $transaction: (fn: any) => fn(tx) } as any;
  return { prisma, tx, employee };
}

describe("business employee management", () => {
  it("allows the owner to hire a player with no elevated permissions", async () => {
    const { prisma, tx } = setup();
    const result = await hireBusinessEmployee(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", nickname: "PlayerTwo", jobTitle: "Кассир" });
    expect(tx.businessEmployee.create).toHaveBeenCalledWith({ data: { businessId: "b1", profileId: "p2", jobTitle: "Кассир" } });
    expect(result.canManageCash).toBe(false);
    expect(tx.adminAuditLog.create).toHaveBeenCalled();
  });

  it("rejects hiring unknown players and hiring the owner", async () => {
    const { prisma, tx } = setup();
    tx.playerProfile.findUnique.mockResolvedValueOnce(null);
    await expect(hireBusinessEmployee(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", nickname: "Missing", jobTitle: "Кассир" })).rejects.toThrow("PLAYER_NOT_FOUND");
    tx.playerProfile.findUnique.mockResolvedValueOnce({ id: "owner", nickname: "Owner" });
    await expect(hireBusinessEmployee(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", nickname: "Owner", jobTitle: "Кассир" })).rejects.toThrow("CANNOT_HIRE_SELF_OR_OWNER");
  });

  it("lets only the owner assign elevated employee permissions", async () => {
    const { prisma, tx } = setup();
    await updateBusinessEmployee(prisma, { actorUserId: "u1", actorProfileId: "owner", businessId: "b1", employeeId: "e1", jobTitle: "Менеджер", canManageStaff: true, canManageStock: true, canManageCash: true });
    expect(tx.businessEmployee.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { jobTitle: "Менеджер", canManageStaff: true, canManageStock: true, canManageCash: true } });
    tx.business.findFirst.mockResolvedValueOnce(null);
    await expect(updateBusinessEmployee(prisma, { actorUserId: "u2", actorProfileId: "other", businessId: "b1", employeeId: "e1", jobTitle: "Менеджер", canManageStaff: false, canManageStock: false, canManageCash: false })).rejects.toThrow("BUSINESS_OWNER_REQUIRED");
  });

  it("prevents delegated managers from dismissing privileged employees", async () => {
    const { prisma, tx } = setup();
    tx.business.findUnique.mockResolvedValueOnce({ id: "b1", ownerProfileId: "owner", status: "ACTIVE" });
    tx.businessEmployee.findUnique.mockResolvedValueOnce({ canManageStaff: true });
    tx.businessEmployee.findFirst.mockResolvedValueOnce({ id: "e1", profileId: "p2", canManageStaff: true, canManageStock: false, canManageCash: false, profile: { nickname: "Manager" } });
    await expect(dismissBusinessEmployee(prisma, { actorUserId: "u2", actorProfileId: "manager", businessId: "b1", employeeId: "e1" })).rejects.toThrow("OWNER_REQUIRED_TO_DISMISS_PRIVILEGED_EMPLOYEE");
    expect(tx.businessEmployee.delete).not.toHaveBeenCalled();
  });

  it("lists staff only for owners or authorized managers", async () => {
    const { prisma, tx } = setup();
    await listBusinessEmployees(prisma, "owner", "b1");
    expect(tx.businessEmployee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: "b1" } }));
    tx.businessEmployee.findUnique.mockResolvedValueOnce({ canManageStaff: false });
    await expect(listBusinessEmployees(prisma, "stranger", "b1")).rejects.toThrow("BUSINESS_PERMISSION_DENIED");
  });
});
