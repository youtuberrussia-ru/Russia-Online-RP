import { WorldSessionManager } from "./sessionManager.js";
// Process-local prototype. Replace with shared rooms before horizontal scaling.
export const worldSessions=new WorldSessionManager(1000);
