import type { Prisma,PrismaClient } from "@prisma/client";
export async function writeAudit(prisma:Pick<Prisma.TransactionClient,"adminAuditLog">,input:{actorId:string;action:string;targetType:string;targetId:string;reason:string;metadata?:Prisma.InputJsonObject}){
 return prisma.adminAuditLog.create({data:{actorId:input.actorId,action:input.action,targetType:input.targetType,targetId:input.targetId,reason:input.reason,...(input.metadata?{metadata:input.metadata}:{})}});
}