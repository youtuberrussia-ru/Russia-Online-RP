import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getVehicleCatalog } from "../services/vehicleCatalog.js";
import { getPropertyCatalog } from "../services/properties.js";
import { getBusinessCatalog } from "../services/businesses.js";
import { getBusinessProductCatalog } from "../services/businessCommerce.js";
import { FORUM_CATEGORIES, getForumThread, listForumThreads } from "../services/forum.js";
export async function gameRoutes(app:FastifyInstance){
 app.get("/vehicles",async()=>getVehicleCatalog());
 app.get("/properties",async()=>getPropertyCatalog());
 app.get("/businesses",async()=>getBusinessCatalog(app.prisma));
 app.get("/business-products",async(request,reply)=>{
  const parsed=z.object({businessType:z.string().max(30).optional()}).safeParse(request.query);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  return getBusinessProductCatalog(parsed.data.businessType);
 });
 app.get("/organizations",async()=>{
  const rows=await app.prisma.organization.findMany({orderBy:{name:"asc"},select:{code:true,name:true,description:true,ranks:{orderBy:{rank:"asc"},select:{rank:true,title:true,salary:true}}}});
  return rows.map(org=>({...org,ranks:org.ranks.map(rank=>({...rank,salary:rank.salary.toString()}))}));
 });
 app.get("/forum/categories",async()=>FORUM_CATEGORIES);
 app.get("/forum/categories/:code/threads",async(request,reply)=>{
  const p=z.object({code:z.string().max(30)}).safeParse(request.params);
  const q=z.object({page:z.coerce.number().int().min(1).max(100).default(1)}).safeParse(request.query);
  if(!p.success||!q.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{return await listForumThreads(app.prisma,p.data.code,q.data.page);}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:"FORUM_CATEGORY_NOT_FOUND"});}
 });
 app.get("/forum/threads/:id",async(request,reply)=>{
  const p=z.object({id:z.string().min(1).max(64)}).safeParse(request.params);
  if(!p.success)return reply.code(400).send({error:"INVALID_INPUT"});
  try{return await getForumThread(app.prisma,p.data.id);}catch(e){return reply.code(404).send({error:e instanceof Error?e.message:"FORUM_THREAD_NOT_FOUND"});}
 });
}
