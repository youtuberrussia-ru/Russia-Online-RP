import type { FastifyInstance,FastifyRequest,FastifyReply } from "fastify";
import { z } from "zod";
import { writeAudit } from "../services/audit.js";
const reviewSchema=z.object({decision:z.enum(["ACCEPT","REJECT"]),note:z.string().trim().min(5).max(1000)});
async function requirePlayer(request:FastifyRequest,reply:FastifyReply){
 try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
 if(request.user.role!=="PLAYER")return reply.code(403).send({error:"PLAYER_SESSION_REQUIRED"});
 const activeBan=await request.server.prisma.accountBan.findFirst({where:{userId:request.user.sub,status:"ACTIVE"}});
 if(activeBan)return reply.code(403).send({error:"ACCOUNT_BANNED"});
}
export async function organizationLeaderRoutes(app:FastifyInstance){
 app.get("/:code/applications",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({code:z.string()}).safeParse(request.params);
  if(!params.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const org=await app.prisma.organization.findUnique({where:{code:params.data.code as never}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const leadership=await app.prisma.orgMembership.findFirst({where:{profileId:profile.id,organizationId:org.id,active:true,rank:{rank:{gte:10}}}});
  if(!leadership)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  return app.prisma.organizationApplication.findMany({where:{organizationId:org.id,status:"PENDING"},include:{profile:{select:{nickname:true,level:true}}},orderBy:{createdAt:"asc"},take:100});
 });
 app.post("/:code/applications/:id/review",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({code:z.string(),id:z.string()}).safeParse(request.params);
  const parsed=reviewSchema.safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const org=await app.prisma.organization.findUnique({where:{code:params.data.code as never}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const leadership=await app.prisma.orgMembership.findFirst({where:{profileId:profile.id,organizationId:org.id,active:true,rank:{rank:{gte:10}}}});
  if(!leadership)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const application=await app.prisma.organizationApplication.findFirst({where:{id:params.data.id,organizationId:org.id,status:"PENDING"}});
  if(!application)return reply.code(404).send({error:"PENDING_APPLICATION_NOT_FOUND"});
  const result=await app.prisma.$transaction(async tx=>{
   if(parsed.data.decision==="ACCEPT"){
    const firstRank=await tx.organizationRank.findFirst({where:{organizationId:org.id,rank:1}});
    if(!firstRank)throw new Error("ORGANIZATION_RANKS_NOT_CONFIGURED");
    await tx.orgMembership.upsert({where:{profileId_organizationId:{profileId:application.profileId,organizationId:org.id}},update:{rankId:firstRank.id,active:true,joinedAt:new Date()},create:{profileId:application.profileId,organizationId:org.id,rankId:firstRank.id}});
   }
   return tx.organizationApplication.update({where:{id:application.id},data:{status:parsed.data.decision==="ACCEPT"?"ACCEPTED":"REJECTED",reviewedBy:request.user.sub,reviewNote:parsed.data.note}});
  });
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"ORG_APPLICATION_REVIEWED",targetType:"organization_application",targetId:application.id,reason:parsed.data.note,metadata:{decision:parsed.data.decision,organization:org.code}});
  return reply.send({id:result.id,status:result.status});
 });

 app.get("/:code/members",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({code:z.string()}).safeParse(request.params);
  if(!params.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const org=await app.prisma.organization.findUnique({where:{code:params.data.code as never}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const actor=await app.prisma.orgMembership.findFirst({where:{profileId:profile.id,organizationId:org.id,active:true},include:{rank:true}});
  if(!actor||actor.rank.rank<10||!actor.rank.permissions.includes("org.view"))return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const members=await app.prisma.orgMembership.findMany({where:{organizationId:org.id,active:true},include:{profile:{select:{nickname:true,level:true}},rank:{select:{rank:true,title:true}}},orderBy:[{rank:{rank:"desc"}},{joinedAt:"asc"}]});
  return members.map(member=>({id:member.id,nickname:member.profile.nickname,level:member.profile.level,rank:member.rank.rank,rankTitle:member.rank.title,joinedAt:member.joinedAt}));
 });
 app.patch("/:code/members/:memberId/rank",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({code:z.string(),memberId:z.string()}).safeParse(request.params);
  const parsed=z.object({action:z.enum(["PROMOTE","DEMOTE"]),note:z.string().trim().min(5).max(500)}).strict().safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const org=await app.prisma.organization.findUnique({where:{code:params.data.code as never}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const actor=await app.prisma.orgMembership.findFirst({where:{profileId:profile.id,organizationId:org.id,active:true},include:{rank:true}});
  const needed=parsed.data.action==="PROMOTE"?"org.promote":"org.demote";
  if(!actor||actor.rank.rank<10||!actor.rank.permissions.includes(needed))return reply.code(403).send({error:"INSUFFICIENT_ORG_PERMISSION"});
  const target=await app.prisma.orgMembership.findFirst({where:{id:params.data.memberId,organizationId:org.id,active:true},include:{rank:true}});
  if(!target)return reply.code(404).send({error:"ACTIVE_MEMBER_NOT_FOUND"});
  if(target.profileId===profile.id||target.rank.rank>=actor.rank.rank)return reply.code(403).send({error:"CANNOT_MANAGE_EQUAL_OR_HIGHER_RANK"});
  const nextRank=target.rank.rank+(parsed.data.action==="PROMOTE"?1:-1);
  if(nextRank<1||nextRank>=actor.rank.rank)return reply.code(409).send({error:"RANK_CHANGE_OUT_OF_RANGE"});
  const rank=await app.prisma.organizationRank.findUnique({where:{organizationId_rank:{organizationId:org.id,rank:nextRank}}});
  if(!rank)return reply.code(409).send({error:"TARGET_RANK_NOT_CONFIGURED"});
  const updated=await app.prisma.orgMembership.update({where:{id:target.id},data:{rankId:rank.id}});
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"ORG_MEMBER_RANK_CHANGED",targetType:"org_membership",targetId:target.id,reason:parsed.data.note,metadata:{organization:org.code,fromRank:target.rank.rank,toRank:nextRank}});
  return reply.send({id:updated.id,rank:nextRank,rankTitle:rank.title});
 });
 app.post("/:code/members/:memberId/dismiss",{preHandler:requirePlayer},async(request,reply)=>{
  const params=z.object({code:z.string(),memberId:z.string()}).safeParse(request.params);
  const parsed=z.object({note:z.string().trim().min(5).max(500)}).strict().safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const org=await app.prisma.organization.findUnique({where:{code:params.data.code as never}});
  if(!org)return reply.code(404).send({error:"ORGANIZATION_NOT_FOUND"});
  const profile=await app.prisma.playerProfile.findUnique({where:{userId:request.user.sub}});
  if(!profile)return reply.code(403).send({error:"LEADER_ACCESS_REQUIRED"});
  const actor=await app.prisma.orgMembership.findFirst({where:{profileId:profile.id,organizationId:org.id,active:true},include:{rank:true}});
  if(!actor||actor.rank.rank<10||!actor.rank.permissions.includes("org.dismiss"))return reply.code(403).send({error:"INSUFFICIENT_ORG_PERMISSION"});
  const target=await app.prisma.orgMembership.findFirst({where:{id:params.data.memberId,organizationId:org.id,active:true},include:{rank:true}});
  if(!target)return reply.code(404).send({error:"ACTIVE_MEMBER_NOT_FOUND"});
  if(target.profileId===profile.id||target.rank.rank>=actor.rank.rank)return reply.code(403).send({error:"CANNOT_DISMISS_EQUAL_OR_HIGHER_RANK"});
  await app.prisma.orgMembership.update({where:{id:target.id},data:{active:false}});
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"ORG_MEMBER_DISMISSED",targetType:"org_membership",targetId:target.id,reason:parsed.data.note,metadata:{organization:org.code,rank:target.rank.rank}});
  return reply.send({id:target.id,active:false});
 });
}
