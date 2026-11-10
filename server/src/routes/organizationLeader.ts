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
}
