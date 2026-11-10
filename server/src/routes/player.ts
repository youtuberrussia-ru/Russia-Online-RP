import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { claimDailyReward } from "../services/dailyRewards.js";
const reportSchema=z.object({targetId:z.string().optional(),category:z.enum(["PLAYER","BUG","CHEATING","OTHER"]),description:z.string().trim().min(20).max(2000)});
const applicationSchema=z.object({organizationCode:z.enum(["MVD","FSB","ARMY","EMERCOM","HEALTH","PROSECUTOR","GOVERNMENT","TRAFFIC_POLICE","MEDIA","FSIN","CENTRAL_BANK"]),answers:z.record(z.string(),z.string().max(1000)).refine(v=>Object.keys(v).length>0)});
export async function playerRoutes(app:FastifyInstance){
 app.get("/me",async(request,reply)=>{
  try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
  const user=await app.prisma.user.findUnique({where:{id:request.user.sub},select:{id:true,email:true,createdAt:true,profile:{include:{memberships:{where:{active:true},include:{organization:true,rank:true}}}},wallet:{select:{balance:true}}}});
  if(!user)return reply.code(404).send({error:"USER_NOT_FOUND"});
  return {...user,wallet:user.wallet?{balance:user.wallet.balance.toString()}:null};
 });
 app.post("/reports",{preHandler:async(request,reply)=>{try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}}},async(request,reply)=>{
  const parsed=reportSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const report=await app.prisma.playerReport.create({data:{authorId:request.user.sub,...parsed.data}});
  return reply.code(201).send({id:report.id,status:report.status,createdAt:report.createdAt});
 });
 app.post("/organizations/applications",{preHandler:async(request,reply)=>{try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}}},async(request,reply)=>{
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
 app.post("/daily-rewards/claim",{preHandler:async(request,reply)=>{try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}}},async(request,reply)=>{
  try{return await claimDailyReward(app.prisma,request.user.sub);}
  catch(error){request.log.error(error);return reply.code(409).send({error:"CLAIM_CONFLICT_OR_WALLET_UNAVAILABLE"});}
 });
}