import type { PrismaClient } from "@prisma/client";
const rewards=[2000n,3000n,4000n,5000n,7000n,9000n,15000n];
function dayKey(date:Date){return date.toISOString().slice(0,10);}
export async function claimDailyReward(prisma:PrismaClient,userId:string,now=new Date()){
 const today=dayKey(now);
 const yesterday=dayKey(new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-1)));
 return prisma.$transaction(async tx=>{
  const existing=await tx.dailyRewardClaim.findUnique({where:{userId_dayKey:{userId,dayKey:today}}});
  if(existing)return {claimed:false,amount:existing.amount.toString(),streak:existing.streak,dayKey:today};
  const previous=await tx.dailyRewardClaim.findFirst({where:{userId},orderBy:{dayKey:"desc"}});
  const streak=previous?.dayKey===yesterday?previous.streak+1:1;
  const amount=rewards[(streak-1)%rewards.length]!;
  const wallet=await tx.wallet.findUnique({where:{userId}});
  if(!wallet)throw new Error("WALLET_NOT_FOUND");
  const balance=wallet.balance+amount;
  await tx.wallet.update({where:{id:wallet.id},data:{balance}});
  await tx.economyTransaction.create({data:{walletId:wallet.id,amount,balanceAfter:balance,reason:"Ежедневная награда",idempotencyKey:`daily:${userId}:${today}`}});
  await tx.dailyRewardClaim.create({data:{userId,dayKey:today,amount,streak}});
  return {claimed:true,amount:amount.toString(),streak,dayKey:today,balance:balance.toString()};
 },{isolationLevel:"Serializable"});
}