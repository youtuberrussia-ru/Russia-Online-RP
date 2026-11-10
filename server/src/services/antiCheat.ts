import type { PrismaClient } from "@prisma/client";
/** Only trusted server simulation code may call this service. Never pass client-reported suspicion. */
export type ValidatedCheatEvidence={source:"movement-validator"|"combat-validator"|"inventory-validator"|"economy-validator";ruleId:string;observedAt:string;serverTraceId:string;confidence:"corroborated";details:Record<string,string|number|boolean>};
export async function applyConfirmedCheatBan(prisma:PrismaClient,input:{userId:string;evidence:ValidatedCheatEvidence[]}){
 if(input.evidence.length<2 || new Set(input.evidence.map(e=>e.source)).size<2 || new Set(input.evidence.map(e=>e.serverTraceId)).size<2) throw new Error("Permanent ban requires at least two independent corroborated server signals.");
 if(input.evidence.some(e=>e.confidence!=="corroborated")) throw new Error("Unconfirmed evidence cannot trigger a permanent ban.");
 return prisma.$transaction(async tx=>{
  const active=await tx.accountBan.findFirst({where:{userId:input.userId,status:"ACTIVE"}});
  if(active)return active;
  return tx.accountBan.create({data:{userId:input.userId,reason:"ЧИТЫ / НЕЗАКОННОЕ ПО",evidence:input.evidence}});
 });
}