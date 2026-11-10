import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { WorldSessionManager } from "../world/sessionManager.js";

// Process-local prototype only. Production must replace this with shared room state
// and authenticated WebSocket transport before multiple server instances are enabled.
const world = new WorldSessionManager(1000);
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
      const previous = world.getSnapshot().find(player => player.playerId === request.user.sub);
      if (!previous) return reply.code(409).send({ error: "PLAYER_NOT_IN_WORLD" });
      // Delta is calculated by the server. The client cannot submit position, speed or time.
      const deltaSeconds = Math.min(0.05, Math.max(0, (now - (world as any).lastUpdatedAt) / 1000));
      const player = world.applyInput(request.user.sub, parsed.data, deltaSeconds || 0.05, now, false);
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
}
