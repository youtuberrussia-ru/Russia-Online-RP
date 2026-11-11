import type { PrismaClient } from "@prisma/client";

export async function takeVehicleOut(prisma: PrismaClient, userId: string, vehicleId: string) {
  return prisma.$transaction(async tx => {
    const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const vehicle = await tx.playerVehicle.findFirst({ where: { id: vehicleId, profileId: profile.id } });
    if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");
    if (vehicle.status === "ACTIVE") {
      return { changed: false, vehicleId: vehicle.id, status: vehicle.status };
    }
    if (vehicle.status === "IMPOUNDED") throw new Error("VEHICLE_IMPOUNDED");
    const active = await tx.playerVehicle.findFirst({ where: { profileId: profile.id, status: "ACTIVE" } });
    if (active) throw new Error("ANOTHER_VEHICLE_ALREADY_ACTIVE");
    const result = await tx.playerVehicle.updateMany({
      where: { id: vehicle.id, profileId: profile.id, status: "STORED" },
      data: { status: "ACTIVE" }
    });
    if (result.count !== 1) throw new Error("VEHICLE_STATE_CONFLICT");
    return { changed: true, vehicleId: vehicle.id, status: "ACTIVE" as const };
  }, { isolationLevel: "Serializable" });
}

export async function parkVehicle(prisma: PrismaClient, userId: string, vehicleId: string) {
  return prisma.$transaction(async tx => {
    const profile = await tx.playerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error("PROFILE_NOT_FOUND");
    const result = await tx.playerVehicle.updateMany({
      where: { id: vehicleId, profileId: profile.id, status: "ACTIVE" },
      data: { status: "STORED" }
    });
    if (result.count !== 1) {
      const vehicle = await tx.playerVehicle.findFirst({ where: { id: vehicleId, profileId: profile.id }, select: { status: true } });
      if (!vehicle) throw new Error("VEHICLE_NOT_FOUND");
      if (vehicle.status === "IMPOUNDED") throw new Error("VEHICLE_IMPOUNDED");
      throw new Error("VEHICLE_NOT_ACTIVE");
    }
    return { changed: true, vehicleId, status: "STORED" as const };
  }, { isolationLevel: "Serializable" });
}
