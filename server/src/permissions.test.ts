import {describe,expect,it} from "vitest";
import {hasPermission,canAppointAdmin} from "./permissions.js";
describe("admin permission boundaries",()=>{
 it("allows GA and ZGA broad operational access",()=>{
  expect(hasPermission("GA","economy.adjust")).toBe(true);
  expect(hasPermission("ZGA","security.review")).toBe(true);
 });
 it("keeps staff appointment owner-only",()=>{
  expect(hasPermission("GA","staff.appoint")).toBe(false);
  expect(canAppointAdmin(false)).toBe(false);
  expect(canAppointAdmin(true)).toBe(true);
 });
 it("limits junior moderators",()=>{
  expect(hasPermission("JUNIOR_MODERATOR","players.ban")).toBe(false);
  expect(hasPermission("JUNIOR_MODERATOR","reports.manage")).toBe(true);
 });
});