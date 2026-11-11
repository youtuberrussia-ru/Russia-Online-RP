import type { FastifyInstance } from "fastify";
import { getVehicleCatalog } from "../services/vehicleCatalog.js";
export async function gameRoutes(app:FastifyInstance){\n app.get("/vehicles",async()=>getVehicleCatalog());
 app.get("/organizations",async()=>{
  const rows=await app.prisma.organization.findMany({orderBy:{name:"asc"},select:{code:true,name:true,description:true,ranks:{orderBy:{rank:"asc"},select:{rank:true,title:true,salary:true}}}});
  return rows.map(org=>({...org,ranks:org.ranks.map(rank=>({...rank,salary:rank.salary.toString()}))}));
 });
}