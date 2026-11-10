import { z } from "zod";
const schema=z.object({
 NODE_ENV:z.enum(["development","test","production"]).default("development"),
 PORT:z.coerce.number().int().min(1).max(65535).default(3000),
 DATABASE_URL:z.string().url(),
 JWT_SECRET:z.string().min(32),
 JWT_ISSUER:z.string().default("russia-online-rp"),
 JWT_AUDIENCE:z.string().default("russia-online-rp-client"),
 OWNER_USER_ID:z.string().optional().default(""),
 CORS_ORIGINS:z.string().default("http://localhost:5173")
});
export const env=schema.parse(process.env);
export const corsOrigins=env.CORS_ORIGINS.split(",").map(v=>v.trim()).filter(Boolean);