import {describe,expect,it} from "vitest";
import {WorldSessionManager} from "./sessionManager.js";
describe("world session manager",()=>{
 it("creates and removes player sessions",()=>{
  const world=new WorldSessionManager(2);
  world.join("player-a");
  expect(world.size).toBe(1);
  expect(world.leave("player-a")).toBe(true);
  expect(world.size).toBe(0);
 });
 it("rejects duplicate sessions and capacity overflow",()=>{
  const world=new WorldSessionManager(1);
  world.join("player-a");
  expect(()=>world.join("player-a")).toThrow("PLAYER_ALREADY_IN_WORLD");
  expect(()=>world.join("player-b")).toThrow("WORLD_CAPACITY_REACHED");
 });
 it("updates server-owned player state from input",()=>{
  const world=new WorldSessionManager();
  world.join("player-a");
  const state=world.applyInput("player-a",{sequence:1,forward:1,strafe:0,turn:0},0.05,1000);
  expect(state.position.z).toBeCloseTo(0.225);
  expect(world.getSnapshot()).toHaveLength(1);
 });
 it("rejects input from a player without an active session",()=>{
  const world=new WorldSessionManager();
  expect(()=>world.applyInput("missing",{sequence:1,forward:1,strafe:0,turn:0},0.016,1000)).toThrow("PLAYER_NOT_IN_WORLD");
 });
});
