import type { FastifyInstance } from "fastify";
import { getVehicleCatalog } from "../services/vehicleCatalog.js";
import { getPropertyCatalog } from "../services/properties.js";
import { getBusinessCatalog } from "../services/businesses.js";
import { getBusinessProductCatalog } from "../services/businessCommerce.js";
export async function gameRoutes(app:FastifyInstance){
 app.get("/vehicles",async()=>getVehicleCatalog());
 app.get("/properties",async()=>getPropertyCatalog());
 app.get("/businesses",async()=>getBusinessCatalog(app.prisma));
 app.get("/business-products",async(request,reply)=>{
  const parsed=(await import("zod")).z.object({businessType:(await import("zod")).z.string().optional()}).safeParse(request.query);
  if(!parsed.success)return reply.code(400).send({error:"INVALID_INPUT"});
  return getBusinessProductCatalog(parsed.data.businessType);
 });
 app.get("/organizations",async()=>{
  const rows=await app.prisma.organization.findMany({orderBy:{name:"asc"},select:{code:true,name:true,description:true,ranks:{orderBy:{rank:"asc"},select:{rank:true,title:true,salary:true}}}});
  return rows.map(org=>({...org,ranks:org.ranks.map(rank=>({...rank,salary:rank.salary.toString()}))}));
 });
}