import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { worldSessions as world } from "../world/runtime.js";
import { getBusinessProductCatalog } from "../services/businessCommerce.js";

const inputSchema = z.object({
  sequence: z.number().int().positive(),
  forward: z.number().min(-1).max(1),
  strafe: z.number().min(-1).max(1),
  turn: z.number().min(-1).max(1)
}).strict();

async function requirePlayer(request: FastifyRequest, reply: FastifyReply) {
  try { await request.jwtVerify(); }
  catch { return reply.code(401).send({ error: "UNAUTHORIZED" }); }
  if (request.user.role !== "PLAYER") return reply.code(403).send({ error: "PLAYER_SESSION_REQUIRED" });
  const ban = await request.server.prisma.accountBan.findFirst({
    where: { userId: request.user.sub, status: "ACTIVE" },
    select: { id: true }
  });
  if (ban) return reply.code(403).send({ error: "ACCOUNT_BANNED" });
}

export async function worldRoutes(app: FastifyInstance) {
  app.post("/join", { preHandler: requirePlayer, config: { rateLimit: { max: 3, timeWindow: "1 minute" } } }, async (request, reply) => {
    try {
      const state = world.join(request.user.sub);
      return reply.code(201).send({ joined: true, player: state, playersOnlineInThisInstance: world.size });
    } catch (error) {
      const code = error instanceof Error ? error.message : "WORLD_JOIN_FAILED";
      const status = code === "PLAYER_ALREADY_IN_WORLD" ? 409 : code === "WORLD_CAPACITY_REACHED" ? 503 : 400;
      return reply.code(status).send({ error: code });
    }
  });

  app.post("/input", { preHandler: requirePlayer, config: { rateLimit: { max: 30, timeWindow: "1 second" } } }, async (request, reply) => {
    const parsed = inputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT" });
    const now = Date.now();
    try {
      // Delta is calculated from the server's previous accepted input timestamp.
      // The client cannot submit position, speed, elapsed time or sprint state.
      const player = world.applyInputAt(request.user.sub, parsed.data, now);
      return { player, playersOnlineInThisInstance: world.size };
    } catch (error) {
      const code = error instanceof Error ? error.message : "MOVEMENT_REJECTED";
      return reply.code(400).send({ error: code });
    }
  });

  app.post("/leave", { preHandler: requirePlayer }, async (request) => ({
    left: world.leave(request.user.sub),
    playersOnlineInThisInstance: world.size
  }));

  app.get("/snapshot", { preHandler: requirePlayer, config: { rateLimit: { max: 10, timeWindow: "1 second" } } }, async (request) => ({
    serverTime: new Date().toISOString(),
    players: world.getSnapshot(),
    playersOnlineInThisInstance: world.size
  }));
  app.get("/nearby",{preHandler:requirePlayer,config:{rateLimit:{max:10,timeWindow:"1 second"}}},async(request,reply)=>{
    const player=world.getPlayerSnapshot(request.user.sub);
    if(!player)return reply.code(409).send({error:"PLAYER_NOT_IN_WORLD"});
    const rows=await app.prisma.business.findMany({where:{status:"ACTIVE"},select:{id:true,businessCode:true,displayName:true,businessType:true,district:true,worldX:true,worldZ:true}});
    return rows.map(b=>({...b,distance:Number(Math.hypot(player.position.x-b.worldX,player.position.z-b.worldZ).toFixed(2))})).filter(b=>b.distance<=25).sort((a,b)=>a.distance-b.distance);
  });
  app.post("/interact",{preHandler:requirePlayer,config:{rateLimit:{max:8,timeWindow:"1 second"}}},async(request,reply)=>{
    const p=z.object({businessId:z.string().min(1).max(64)}).strict().safeParse(request.body);
    if(!p.success)return reply.code(400).send({error:"INVALID_INPUT"});
    const player=world.getPlayerSnapshot(request.user.sub);
    if(!player)return reply.code(409).send({error:"PLAYER_NOT_IN_WORLD"});
    const business=await app.prisma.business.findFirst({where:{id:p.data.businessId,status:"ACTIVE"},select:{id:true,displayName:true,businessType:true,district:true,worldX:true,worldZ:true}});
    if(!business)return reply.code(404).send({error:"BUSINESS_NOT_FOUND"});
    const distance=Math.hypot(player.position.x-business.worldX,player.position.z-business.worldZ);
    if(distance>4.5)return reply.code(403).send({error:"TOO_FAR_TO_INTERACT",distance:Number(distance.toFixed(2))});
    const [stock,catalog]=await Promise.all([app.prisma.businessStockItem.findMany({where:{businessId:business.id},select:{productCode:true,quantity:true}}),Promise.resolve(getBusinessProductCatalog(business.businessType))]);
    const inventory=catalog.map(item=>({...item,quantity:stock.find(x=>x.productCode===item.code)?.quantity??0}));
    const actions=business.businessType==="SERVICE"?["OPEN_SERVICE_DESK"]:business.businessType==="FUEL"?["OPEN_FUEL_SHOP"]:["OPEN_SHOP"];
    return {interacted:true,business,distance:Number(distance.toFixed(2)),actions,inventory};
  });
}
