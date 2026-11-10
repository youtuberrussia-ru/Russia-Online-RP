import type { PrismaClient,AdminRole } from "@prisma/client";
import type { env } from "./config.js";
declare module "fastify" {
 interface FastifyInstance { prisma:PrismaClient; config:typeof env; }
 interface FastifyRequest { adminRole:AdminRole|null; }
}
declare module "@fastify/jwt" {
 interface FastifyJWT {
  payload: { sub:string; role:string; scope?:string };
  user: { sub:string; role:string; scope?:string };
 }
}
