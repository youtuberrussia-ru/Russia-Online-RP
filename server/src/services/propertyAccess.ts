export type PropertyAccessPermissions = { nickname: string; canEnter: boolean; canUseStorage: boolean; canPark: boolean };

export async function listSharedProperties(prisma: import("@prisma/client").PrismaClient, profileId: string) {
  const grants = await prisma.propertyAccess.findMany({
    where: { granteeProfileId: profileId, property: { status: "OWNED" } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, canEnter: true, canUseStorage: true, canPark: true, createdAt: true,
      property: { select: { id: true, displayName: true, propertyType: true, district: true, interiorCode: true } }
    }
  });
  return grants;
}

export async function listPropertyAccess(prisma: import("@prisma/client").PrismaClient, ownerProfileId: string, propertyId: string) {
  const property = await prisma.playerProperty.findFirst({ where: { id: propertyId, profileId: ownerProfileId, status: "OWNED" }, select: { id: true } });
  if (!property) throw new Error("PROPERTY_NOT_FOUND");
  return prisma.propertyAccess.findMany({
    where: { propertyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, canEnter: true, canUseStorage: true, canPark: true, createdAt: true, updatedAt: true, grantee: { select: { id: true, nickname: true } } }
  });
}

export async function grantPropertyAccess(
  prisma: import("@prisma/client").PrismaClient,
  ownerProfileId: string,
  propertyId: string,
  input: PropertyAccessPermissions
) {
  const property = await prisma.playerProperty.findFirst({ where: { id: propertyId, profileId: ownerProfileId, status: "OWNED" }, select: { id: true } });
  if (!property) throw new Error("PROPERTY_NOT_FOUND");
  const grantee = await prisma.playerProfile.findUnique({ where: { nickname: input.nickname }, select: { id: true, nickname: true } });
  if (!grantee) throw new Error("PLAYER_NOT_FOUND");
  if (grantee.id === ownerProfileId) throw new Error("CANNOT_GRANT_SELF");
  const grant = await prisma.propertyAccess.upsert({
    where: { propertyId_granteeProfileId: { propertyId, granteeProfileId: grantee.id } },
    create: { propertyId, granteeProfileId: grantee.id, canEnter: input.canEnter, canUseStorage: input.canUseStorage, canPark: input.canPark },
    update: { canEnter: input.canEnter, canUseStorage: input.canUseStorage, canPark: input.canPark }
  });
  return { id: grant.id, nickname: grantee.nickname, canEnter: grant.canEnter, canUseStorage: grant.canUseStorage, canPark: grant.canPark, updatedAt: grant.updatedAt };
}

export async function revokePropertyAccess(
  prisma: import("@prisma/client").PrismaClient,
  ownerProfileId: string,
  propertyId: string,
  granteeProfileId: string
) {
  const property = await prisma.playerProperty.findFirst({ where: { id: propertyId, profileId: ownerProfileId, status: "OWNED" }, select: { id: true } });
  if (!property) throw new Error("PROPERTY_NOT_FOUND");
  const deleted = await prisma.propertyAccess.deleteMany({ where: { propertyId, granteeProfileId } });
  return { revoked: deleted.count === 1 };
}
