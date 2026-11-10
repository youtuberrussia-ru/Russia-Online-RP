import type { FastifyInstance,FastifyRequest,FastifyReply } from "fastify";
import { z } from "zod";
import { hasPermission,type Permission } from "../permissions.js";
import { writeAudit } from "../services/audit.js";

async function requireAdmin(request:FastifyRequest,reply:FastifyReply){
 try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
 const staff=await request.server.prisma.adminStaff.findUnique({where:{userId:request.user.sub}});
 const isOwner=Boolean(request.server.config.OWNER_USER_ID)&&request.user.sub===request.server.config.OWNER_USER_ID;
 if(!staff?.active&&!isOwner)return reply.code(403).send({error:"ADMIN_ACCESS_REQUIRED"});
 request.adminRole=staff?.active?staff.role:"GA";
}
function permission(name:Permission){return async(request:FastifyRequest,reply:FastifyReply)=>{
 if(!request.adminRole||!hasPermission(request.adminRole,name))return reply.code(403).send({error:"INSUFFICIENT_PERMISSION"});
};}
const appointSchema=z.object({userId:z.string().min(1),role:z.enum(["GA","ZGA","SENIOR_ADMIN","ADMIN","SENIOR_MODERATOR","MODERATOR","JUNIOR_MODERATOR"]),reason:z.string().trim().min(5).max(500)});
const revokeSchema=z.object({userId:z.string().min(1),reason:z.string().trim().min(5).max(500)});
const resolveReportSchema=z.object({status:z.enum(["IN_REVIEW","RESOLVED","REJECTED"]),resolution:z.string().trim().min(5).max(1000)});
const appealDecisionSchema=z.object({decision:z.enum(["APPROVED","DENIED"]),note:z.string().trim().min(5).max(1000)});
export async function adminRoutes(app:FastifyInstance){
 app.get("/me",{preHandler:[requireAdmin]},async request=>({userId:request.user.sub,role:request.user.sub===app.config.OWNER_USER_ID?"OWNER":request.adminRole}));
 app.get("/overview",{preHandler:[requireAdmin,permission("dashboard.read")]},async()=>({status:"online",features:["players","economy","organizations","moderation","security"],note:"Live game metrics are connected in a later milestone."}));
 app.post("/staff/appoint",{preHandler:[requireAdmin]},async(request,reply)=>{
  const ownerId=app.config.OWNER_USER_ID;
  if(!ownerId||request.user.sub!==ownerId)return reply.code(403).send({error:"OWNER_ONLY"});
  const parsed=appointSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const target=await app.prisma.user.findUnique({where:{id:parsed.data.userId}});
  if(!target)return reply.code(404).send({error:"USER_NOT_FOUND"});
  const staff=await app.prisma.adminStaff.upsert({where:{userId:parsed.data.userId},update:{role:parsed.data.role,active:true,appointedBy:request.user.sub},create:{userId:parsed.data.userId,role:parsed.data.role,appointedBy:request.user.sub}});
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"ADMIN_STAFF_APPOINTED",targetType:"admin_staff",targetId:staff.id,reason:parsed.data.reason,metadata:{role:parsed.data.role}});
  return reply.code(201).send({id:staff.id,role:staff.role,active:staff.active});
 });
 app.post("/staff/revoke",{preHandler:[requireAdmin]},async(request,reply)=>{
  const ownerId=app.config.OWNER_USER_ID;
  if(!ownerId||request.user.sub!==ownerId)return reply.code(403).send({error:"OWNER_ONLY"});
  const parsed=revokeSchema.safeParse(request.body);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  if(parsed.data.userId===ownerId)return reply.code(400).send({error:"OWNER_CANNOT_REVOKE_SELF"});
  const staff=await app.prisma.adminStaff.findUnique({where:{userId:parsed.data.userId}});
  if(!staff?.active)return reply.code(404).send({error:"ACTIVE_ADMIN_NOT_FOUND"});
  const updated=await app.prisma.adminStaff.update({where:{id:staff.id},data:{active:false}});
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"ADMIN_STAFF_REVOKED",targetType:"admin_staff",targetId:staff.id,reason:parsed.data.reason});
  return reply.send({id:updated.id,active:updated.active});
 });
 app.get("/reports",{preHandler:[requireAdmin,permission("reports.manage")]},async(request)=>{
  const query=request.query as {status?:string};
  const status=["OPEN","IN_REVIEW","RESOLVED","REJECTED"].includes(query.status??"")?query.status as "OPEN"|"IN_REVIEW"|"RESOLVED"|"REJECTED":undefined;
  return app.prisma.playerReport.findMany({where:status?{status}:{},orderBy:{createdAt:"desc"},take:100});
 });
 app.patch("/reports/:id",{preHandler:[requireAdmin,permission("reports.manage")]},async(request,reply)=>{
  const params=z.object({id:z.string().min(1)}).safeParse(request.params);
  const parsed=resolveReportSchema.safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const report=await app.prisma.playerReport.findUnique({where:{id:params.data.id}});
  if(!report)return reply.code(404).send({error:"REPORT_NOT_FOUND"});
  const updated=await app.prisma.playerReport.update({where:{id:report.id},data:{status:parsed.data.status,resolution:parsed.data.resolution,assignedTo:request.user.sub}});
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"PLAYER_REPORT_UPDATED",targetType:"player_report",targetId:report.id,reason:parsed.data.resolution,metadata:{status:parsed.data.status}});
  return reply.send({id:updated.id,status:updated.status,resolution:updated.resolution});
 });
} app.get("/ban-appeals",{preHandler:[requireAdmin,permission("security.review")]},async()=>{
  return app.prisma.banAppeal.findMany({where:{status:"PENDING"},include:{user:{select:{id:true,email:true,profile:{select:{nickname:true}}}},ban:true},orderBy:{createdAt:"asc"},take:100});
 });
 app.patch("/ban-appeals/:id",{preHandler:[requireAdmin,permission("security.review")]},async(request,reply)=>{
  const params=z.object({id:z.string().min(1)}).safeParse(request.params);
  const parsed=appealDecisionSchema.safeParse(request.body);
  if(!params.success||!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  const appeal=await app.prisma.banAppeal.findUnique({where:{id:params.data.id}});
  if(!appeal||appeal.status!=="PENDING")return reply.code(404).send({error:"PENDING_APPEAL_NOT_FOUND"});
  const result=await app.prisma.$transaction(async tx=>{
   const updated=await tx.banAppeal.update({where:{id:appeal.id},data:{status:parsed.data.decision,reviewedBy:request.user.sub,decision:parsed.data.note}});
   if(parsed.data.decision==="APPROVED")await tx.accountBan.update({where:{id:appeal.banId},data:{status:"REVOKED",revokedAt:new Date(),revokedBy:request.user.sub}});
   return updated;
  });
  await writeAudit(app.prisma,{actorId:request.user.sub,action:"BAN_APPEAL_REVIEWED",targetType:"ban_appeal",targetId:appeal.id,reason:parsed.data.note,metadata:{decision:parsed.data.decision}});
  return reply.send({id:result.id,status:result.status});
 });

