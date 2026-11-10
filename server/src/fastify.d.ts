import type { PrismaClient,AdminRole } from "@prisma/client";
import type { env } from "./config.js";
declare module "fastify" {
 interface FastifyInstance { prisma:PrismaClient; config:typeof env; }
 interface FastifyRequest { adminRole:AdminRole|null; }
}