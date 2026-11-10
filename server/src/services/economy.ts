import type { PrismaClient } from "@prisma/client";
export async function applyWalletChange(prisma:PrismaClient,input:{userId:string;amount:bigint;reason:string;idempotencyKey:string}){
 if(input.amount===0n)throw new Error("Zero-value transactions are not allowed.");
 if(input.reason.trim().length<3)throw new Error("A transaction reason is required.");
 return prisma.$transaction(async tx=>{
  const prior=await tx.economyTransaction.findUnique({where:{idempotencyKey:input.idempotencyKey}});
  if(prior)return prior;
  const wallet=await tx.wallet.findUnique({where:{userId:input.userId}});
  if(!wallet)throw new Error("Wallet not found.");
  const next=wallet.balance+input.amount;
  if(next<0n)throw new Error("Insufficient funds.");
  await tx.wallet.update({where:{id:wallet.id},data:{balance:next}});
  return tx.economyTransaction.create({data:{walletId:wallet.id,amount:input.amount,balanceAfter:next,reason:input.reason,idempotencyKey:input.idempotencyKey}});
 });
}