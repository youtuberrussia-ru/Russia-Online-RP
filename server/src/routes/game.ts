import type { FastifyInstance } from "fastify";
import { getVehicleCatalog } from "../services/vehicleCatalog.js";
import { getPropertyCatalog } from "../services/properties.js";
import { getBusinessCatalog } from "../services/businesses.js";
export async function gameRoutes(app:FastifyInstance){
 app.get("/vehicles",async()=>getVehicleCatalog());
 app.get("/properties",async()=>getPropertyCatalog());
 app.get("/businesses",async()=>getBusinessCatalog(app.prisma));
 app.get("/organizations",async()=>{
  const rows=await app.prisma.organization.findMany({orderBy:{name:"asc"},select:{code:true,name:true,description:true,ranks:{orderBy:{rank:"asc"},select:{rank:true,title:true,salary:true}}}});
  return rows.map(org=>({...org,ranks:org.ranks.map(rank=>({...rank,salary:rank.salary.toString()}))}));
 });
}