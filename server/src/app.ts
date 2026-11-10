import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { PrismaClient } from "@prisma/client";
import { env,corsOrigins } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { gameRoutes } from "./routes/game.js";
export function buildApp(){
 const app=Fastify({logger:{level:env.NODE_ENV==="production"?"info":"debug"},bodyLimit:64*1024,trustProxy:false});
 const prisma=new PrismaClient();
 app.decorate("prisma",prisma);
 app.decorate("config",env);
 app.decorateRequest("adminRole",null);
 app.register(helmet);
 app.register(cors,{origin:corsOrigins,credentials:true});
 app.register(rateLimit,{max:100,timeWindow:"1 minute"});
 app.register(jwt,{secret:env.JWT_SECRET,sign:{issuer:env.JWT_ISSUER,audience:env.JWT_AUDIENCE},verify:{issuer:env.JWT_ISSUER,audience:env.JWT_AUDIENCE}});
 app.get("/health",async()=>({status:"ok",service:"russia-online-rp-api"}));
 app.register(authRoutes,{prefix:"/v1/auth"});
 app.register(gameRoutes,{prefix:"/v1/game"});
 app.register(adminRoutes,{prefix:"/v1/admin"});
 app.addHook("onClose",async()=>prisma.$disconnect());
 return app;
}