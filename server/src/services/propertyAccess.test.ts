import { describe, expect, it, vi } from "vitest";
import { grantPropertyAccess, listPropertyAccess, listSharedProperties, revokePropertyAccess } from "./propertyAccess.js";

function fakePrisma() {
  return {
    playerProperty: { findFirst: vi.fn().mockResolvedValue({ id: "property-1" }) },
    playerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "friend-1", nickname: "Friend" }) },
    propertyAccess: {
      upsert: vi.fn().mockResolvedValue({ id: "grant-1", canEnter: true, canUseStorage: false, canPark: true, updatedAt: new Date(0) }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  } as any;
}

describe("property access controls", () => {
  it("only grants permissions on an owned active property", async () => {
    const db = fakePrisma();
    await grantPropertyAccess(db, "owner-1", "property-1", { nickname: "Friend", canEnter: true, canUseStorage: false, canPark: true });
    expect(db.propertyAccess.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ canUseStorage: false, canPark: true }) }));
    db.playerProperty.findFirst.mockResolvedValueOnce(null);
    await expect(grantPropertyAccess(db, "other-owner", "property-1", { nickname: "Friend", canEnter: true, canUseStorage: false, canPark: false })).rejects.toThrow("PROPERTY_NOT_FOUND");
  });

  it("prevents granting access to yourself", async () => {
    const db = fakePrisma();
    db.playerProfile.findUnique.mockResolvedValueOnce({ id: "owner-1", nickname: "Owner" });
    await expect(grantPropertyAccess(db, "owner-1", "property-1", { nickname: "Owner", canEnter: true, canUseStorage: false, canPark: false })).rejects.toThrow("CANNOT_GRANT_SELF");
    expect(db.propertyAccess.upsert).not.toHaveBeenCalled();
  });

  it("rejects unknown players and allows owners to revoke grants", async () => {
    const db = fakePrisma();
    db.playerProfile.findUnique.mockResolvedValueOnce(null);
    await expect(grantPropertyAccess(db, "owner-1", "property-1", { nickname: "Nobody", canEnter: true, canUseStorage: false, canPark: false })).rejects.toThrow("PLAYER_NOT_FOUND");
    await expect(revokePropertyAccess(db, "owner-1", "property-1", "friend-1")).resolves.toEqual({ revoked: true });
  });

  it("lists only grants for the selected owned property and shared properties for a grantee", async () => {
    const db = fakePrisma();
    await listPropertyAccess(db, "owner-1", "property-1");
    expect(db.propertyAccess.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propertyId: "property-1" } }));
    await listSharedProperties(db, "friend-1");
    expect(db.propertyAccess.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { granteeProfileId: "friend-1", property: { status: "OWNED" } } }));
  });
});
