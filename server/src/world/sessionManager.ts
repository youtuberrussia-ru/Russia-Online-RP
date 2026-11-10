import {createPlayerState,simulatePlayerInput,type AuthoritativePlayerState,type PlayerInput,type WorldPosition} from "./simulation.js";
export type WorldPlayerSnapshot={playerId:string;position:WorldPosition;lastInputSequence:number};
export class WorldSessionManager{
 private readonly players=new Map<string,AuthoritativePlayerState>();
 constructor(private readonly capacity=1000){
  if(!Number.isSafeInteger(capacity)||capacity<1)throw new Error("INVALID_WORLD_CAPACITY");
 }
 join(playerId:string,spawn?:WorldPosition){
  if(!playerId.trim())throw new Error("INVALID_PLAYER_ID");
  if(this.players.has(playerId))throw new Error("PLAYER_ALREADY_IN_WORLD");
  if(this.players.size>=this.capacity)throw new Error("WORLD_CAPACITY_REACHED");
  const state=createPlayerState(spawn);
  this.players.set(playerId,state);
  return this.snapshotOne(playerId,state);
 }
 leave(playerId:string){return this.players.delete(playerId);}
 applyInput(playerId:string,input:PlayerInput,deltaSeconds:number,nowMs:number,running=false){
  const current=this.players.get(playerId);
  if(!current)throw new Error("PLAYER_NOT_IN_WORLD");
  const next=simulatePlayerInput(current,input,deltaSeconds,nowMs,running);
  this.players.set(playerId,next);
  return this.snapshotOne(playerId,next);
 }
 getSnapshot():WorldPlayerSnapshot[]{
  return [...this.players.entries()].map(([playerId,state])=>this.snapshotOne(playerId,state)).sort((a,b)=>a.playerId.localeCompare(b.playerId));
 }
 get size(){return this.players.size;}
 private snapshotOne(playerId:string,state:AuthoritativePlayerState):WorldPlayerSnapshot{
  return {playerId,position:{...state.position},lastInputSequence:state.lastInputSequence};
 }
}
