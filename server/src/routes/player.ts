import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { claimDailyReward } from "../services/dailyRewards.js";
import { purchasePlayerVehicle } from "../services/vehiclePurchases.js";
import { cancelJobShift, finishJobShift, JOBS, startJobShift } from "../services/jobs.js";
const reportSchema=z.object({targetId:z.string().optional(),category:z.enum(["PLAYER","BUG","CHEATING","OTHER"]),description:z.string().trim().min(20).max(2000)});
const applicationSchema=z.object({organizationCode:z.enum(["MVD","FSB","ARMY","EMERCOM","HEALTH","PROSECUTOR","GOVERNMENT","TRAFFIC_POLICE","MEDIA","FSIN","CENTRAL_BANK"]),answers:z.record(z.string(),z.string().max(1000)).refine(v=>Object.keys(v).length>0)});
async function requirePlayer(request:import("fastify").FastifyRequest,reply:import("fastify").FastifyReply){
 try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
 if(request.user.role!=="PLAYER")return reply.code(403).send({error:"PLAYER_SESSION_REQUIRED"});
 const activeBan=await request.server.prisma.accountBan.findFirst({where:{userId:request.user.sub,status:"ACTIVE"}});
 if(activeBan)return reply.code(403).send({error:"ACCOUNT_BANNED"});
}
async function requireAppealSession(request:import("fastify").FastifyRequest,reply:import("fastify").FastifyReply){
 try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
 if(request.user.role!=="PLAYER"&&request.user.scope!=="ban:appeal")return reply.code(403).send({error:"APPEAL_SESSION_REQUIRED"});
}
export async function playerRoutes(app:FastifyInstance){

 app.get("/jobs",{preHandler:requirePlayer},async()=>{
  return JOBS.map(job=>({code:job.code,title:job.title,description:job.description,hourlyRate:job.hourlyRate.toString()}));
 });
 app.get("/jobs/shifts",{preHandler:requirePlayer},async(request,reply)=>{
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub},select:{id:true}});
  if(!profile)return reply.code(404).send({error:"PROFILE_NOT_FOUND"});
  const shifts=await app.prisma.jobShift.findMany({where:{profileId:profile.id},orderBy:{startedAt:"desc"},take:20});
  return shifts.map(shift=>({id:shift.id,jobCode:shift.jobCode,status:shift.status,startedAt:shift.startedAt,endedAt:shift.endedAt,payout:shift.payout.toString()}));
 });
 app.post("/jobs/shifts/start",{preHandler:requirePlayer,config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(request,reply)=>{
  const parsed=z.object({jobCode:z.string().min(2).max(30)}).strict().safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{return reply.code(201).send(await startJobShift(app.prisma,request.user.sub,parsed.data.jobCode));}
  catch(error){
   const code=error instanceof Error?error.message:"JOB_START_FAILED";
   const status=code==="JOB_NOT_FOUND"?404:code==="PROFILE_NOT_FOUND"?404:409;
   return reply.code(status).send({error:code});
  }
 });
 app.post("/jobs/shifts/:id/finish",{preHandler:requirePlayer,config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(request,reply)=>{
  const params=z.object({id:z.string().min(1).max(64)}).safeParse(request.params);
  const parsed=z.object({requestId:z.string().uuid()}).strict().safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{return reply.send(await finishJobShift(app.prisma,request.user.sub,params.data.id,parsed.data.requestId));}
  catch(error){
   const code=error instanceof Error?error.message:"JOB_FINISH_FAILED";
   const status=code==="JOB_SHIFT_NOT_FOUND"||code==="PROFILE_NOT_FOUND"||code==="JOB_NOT_FOUND"?404:code==="SHIFT_TOO_SHORT"||code==="DAILY_JOB_LIMIT_REACHED"?409:400;
   return reply.code(status).send({error:code});
  }
 });
 app.post("/jobs/shifts/:id/cancel",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({id:z.string().min(1).max(64)}).safeParse(request.params);
  if(!params.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{return reply.send(await cancelJobShift(app.prisma,request.user.sub,params.data.id));}
  catch(error){
   const code=error instanceof Error?error.message:"JOB_CANCEL_FAILED";
   const status=code==="ACTIVE_JOB_SHIFT_NOT_FOUND"?404:409;
   return reply.code(status).send({error:code});
  }
 });
 app.get("/vehicles",{preHandler:requirePlayer},async(request,reply)=>{
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub},select:{id:true}});
  if(!profile)return reply.code(404).send({error:"PROFILE_NOT_FOUND"});
  const vehicles=await app.prisma.playerVehicle.findMany({where:{profileId:profile.id},orderBy:{createdAt:"desc"},select:{id:true,modelCode:true,displayName:true,plate:true,purchasedPrice:true,status:true,createdAt:true}});
  return vehicles.map(vehicle=>({...vehicle,purchasedPrice:vehicle.purchasedPrice.toString()}));
 });
 app.post("/vehicles/purchase",{preHandler:requirePlayer,config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(request,reply)=>{
  const parsed=z.object({vehicleCode:z.string().min(1).max(40),requestId:z.string().uuid()}).strict().safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{
   const result=await purchasePlayerVehicle(app.prisma,{userId:request.user.sub,...parsed.data});
   return reply.code(result.alreadyPurchased?200:201).send({
    vehicle:{id:result.vehicle.id,modelCode:result.vehicle.modelCode,displayName:result.vehicle.displayName,plate:result.vehicle.plate,status:result.vehicle.status,purchasedPrice:result.vehicle.purchasedPrice.toString()},
    balance:result.balance,
    alreadyPurchased:result.alreadyPurchased
   });
  }catch(error){
   const code=error instanceof Error?error.message:"VEHICLE_PURCHASE_FAILED";
   const status=code==="VEHICLE_NOT_FOUND"||code==="PROFILE_NOT_FOUND"||code==="WALLET_NOT_FOUND"?404:code==="INSUFFICIENT_FUNDS"?409:code==="IDEMPOTENCY_KEY_REUSED"?409:409;
   if(status===409)request.log.warn({code},"Vehicle purchase rejected");
   else request.log.error(error);
   return reply.code(status).send({error:code});
  }
 });

 app.get("/me",{preHandler:requirePlayer},async(request,reply)=>{
  const user=await app.prisma.user.findUnique({where:{id:request.user.sub},select:{id:true,email:true,createdAt:true,profile:{include:{memberships:{where:{active:true},include:{organization:true,rank:true}}}},wallet:{select:{balance:true}}}});
  if(!user)return reply.code(404).send({error:"USER_NOT_FOUND"});
  return {...user,wallet:user.wallet?{balance:user.wallet.balance.toString()}:null};
 });
 app.post("/reports",{preHandler:requirePlayer},async(request,reply)=>{
  const parsed=reportSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const report=await app.prisma.playerReport.create({data:{authorId:request.user.sub,category:parsed.data.category,description:parsed.data.description,...(parsed.data.targetId?{targetId:parsed.data.targetId}:{})}});
  return reply.code(201).send({id:report.id,status:report.status,createdAt:report.createdAt});
 });
 app.post("/organizations/applications",{preHandler:requirePlayer},async(request,reply)=>{
  const parsed=applicationSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(404).send({error:"PROFILE_NOT_FOUND"});
  const org=await app.prisma.organization.findUnique({where:{code:parsed.data.organizationCode}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const pending=await app.prisma.organizationApplication.findFirst({where:{profileId:profile.id,organizationId:org.id,status:"PENDING"}});
  if(pending)return reply.code(409).send({error:"APPLICATION_ALREADY_PENDING"});
  const application=await app.prisma.organizationApplication.create({data:{profileId:profile.id,organizationId:org.id,answers:parsed.data.answers}});
  return reply.code(201).send({id:application.id,status:application.status,createdAt:application.createdAt});
 });
 app.post("/ban-appeals",{preHandler:requireAppealSession},async(request,reply)=>{
  const parsed=z.object({message:z.string().trim().min(30).max(3000)}).safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const ban=await app.prisma.accountBan.findFirst({where:{userId:request.user.sub,status:"ACTIVE"}});
  if(!ban)return reply.code(404).send({error:"ACTIVE_BAN_NOT_FOUND"});
  const pending=await app.prisma.banAppeal.findFirst({where:{banId:ban.id,status:"PENDING"}});
  if(pending)return reply.code(409).send({error:"APPEAL_ALREADY_PENDING"});
  const appeal=await app.prisma.banAppeal.create({data:{userId:request.user.sub,banId:ban.id,message:parsed.data.message}});
  return reply.code(201).send({id:appeal.id,status:appeal.status,createdAt:appeal.createdAt});
 });
 app.post("/daily-rewards/claim",{preHandler:requirePlayer},async(request,reply)=>{
  try{return await claimDailyReward(app.prisma,request.user.sub);}
  catch(error){request.log.error(error);return reply.code(409).send({error:"CLAIM_CONFLICT_OR_WALLET_UNAVAILABLE"});}
 });
}