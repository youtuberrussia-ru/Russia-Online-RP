import {describe,expect,it} from "vitest";
import {applyConfirmedCheatBan} from "./antiCheat.js";
import type {PrismaClient} from "@prisma/client";
const prisma={} as PrismaClient;
const evidence={source:"movement-validator" as const,ruleId:"movement.teleport",observedAt:"2026-01-01T00:00:00.000Z",serverTraceId:"trace-1",confidence:"corroborated" as const,details:{distance:500}};
describe("confirmed-cheat ban safeguards",()=>{
 it("rejects a single signal before touching storage",async()=>{
  await expect(applyConfirmedCheatBan(prisma,{userId:"user-1",evidence:[evidence]})).rejects.toThrow("at least two independent");
 });
 it("rejects duplicate evidence from the same validator and trace",async()=>{
  await expect(applyConfirmedCheatBan(prisma,{userId:"user-1",evidence:[evidence,evidence]})).rejects.toThrow("at least two independent");
 });
 it("rejects non-corroborated signals",async()=>{
  await expect(applyConfirmedCheatBan(prisma,{userId:"user-1",evidence:[evidence,{...evidence,source:"combat-validator",confidence:"suspicious" as never}]})).rejects.toThrow("Unconfirmed evidence");
 });
});
