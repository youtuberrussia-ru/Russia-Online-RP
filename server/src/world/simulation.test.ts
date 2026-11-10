import {describe,expect,it} from "vitest";
import {createPlayerState,simulatePlayerInput} from "./simulation.js";
describe("authoritative movement simulation",()=>{
 it("derives position from input rather than accepting client coordinates",()=>{
  const state=createPlayerState();
  const next=simulatePlayerInput(state,{sequence:1,forward:1,strafe:0,turn:0},0.05,1000);
  expect(next.position.z).toBeCloseTo(0.225);
  expect(next.position.x).toBe(0);
 });
 it("normalizes diagonal input to prevent faster diagonal movement",()=>{
  const state=createPlayerState();
  const next=simulatePlayerInput(state,{sequence:1,forward:1,strafe:1,turn:0},0.05,1000);
  expect(Math.hypot(next.position.x,next.position.z)).toBeCloseTo(0.225);
 });
 it("caps simulation delta to prevent large catch-up jumps",()=>{
  const next=simulatePlayerInput(createPlayerState(),{sequence:1,forward:1,strafe:0,turn:0},5,1000);
  expect(next.position.z).toBeCloseTo(0.225);
 });
 it("rejects stale or replayed input sequence numbers",()=>{
  const state=simulatePlayerInput(createPlayerState(),{sequence:4,forward:0,strafe:0,turn:0},0.016,1000);
  expect(()=>simulatePlayerInput(state,{sequence:4,forward:1,strafe:0,turn:0},0.016,1016)).toThrow("STALE_INPUT_SEQUENCE");
 });
 it("rejects server timestamps moving backwards",()=>{
  const state=simulatePlayerInput(createPlayerState(),{sequence:1,forward:0,strafe:0,turn:0},0.016,1000);
  expect(()=>simulatePlayerInput(state,{sequence:2,forward:0,strafe:0,turn:0},0.016,999)).toThrow("STALE_SERVER_TIMESTAMP");
 });
 it("rejects invalid input outside allowed ranges",()=>{
  expect(()=>simulatePlayerInput(createPlayerState(),{sequence:1,forward:2,strafe:0,turn:0},0.016,1000)).toThrow("MOVEMENT_INPUT_OUT_OF_RANGE");
 });
});
