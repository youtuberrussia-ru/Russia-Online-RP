import type { FastifyInstance,FastifyRequest,FastifyReply } from "fastify";
import { z } from "zod";
import { hasPermission,type Permission } from "../permissions.js";
import { writeAudit } from "../services/audit.js";

async function requireAdmin(request:FastifyRequest,reply:FastifyReply){
 try{await request.jwtVerify();}catch{return reply.code(401).send({error:"UNAUTHORIZED"});}
 const staff=await request.server.prisma.adminStaff.findUnique({where:{userId:request.user.sub}});
 const isConfiguredOwner=Boolean(request.server.config.OWNER_USER_ID)&&request.user.sub===request.server.config.OWNER_USER_ID;
 if(!staff?.active&&!isConfiguredOwner)return reply.code(403).send({error:"ADMIN_ACCESS_REQUIRED"});
 // Owner gets an internal operational fallback role, but owner-only controls remain separate.
 request.adminRole=staff?.active?staff.role:"GA";
}
function permission(name:Permission){return async(request:FastifyRequest,reply:FastifyReply)=>{
 if(!request.adminRole||!hasPermission(request.adminRole,name))return reply.code(403).send({error:"INSUFFICIENT_PERMISSION"});
};}
const appointSchema=z.object({userId:z.string().min(1),role:z.enum(["GA","ZGA","SENIOR_ADMIN","ADMIN","SENIOR_MODERATOR","MODERATOR","JUNIOR_MODERATOR"]),reason:z.string().trim().min(5).max(500)});
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
}
