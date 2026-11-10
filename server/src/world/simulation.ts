export type PlayerInput={sequence:number;forward:number;strafe:number;turn:number};
export type WorldPosition={x:number;y:number;z:number;yaw:number};
export type AuthoritativePlayerState={position:WorldPosition;lastInputSequence:number;lastUpdatedAt:number};
const WALK_SPEED=4.5;
const RUN_SPEED=6.2;
const TURN_RATE=2.4;
const MAX_WORLD_COORDINATE=10000;
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
export function createPlayerState(position:WorldPosition={x:0,y:0,z:0,yaw:0}):AuthoritativePlayerState{
 return {position:{...position},lastInputSequence:0,lastUpdatedAt:0};
}
/** Integrates input on the server. Client-supplied positions, velocities and rewards are never accepted. */
export function simulatePlayerInput(state:AuthoritativePlayerState,input:PlayerInput,deltaSeconds:number,nowMs:number,running=false):AuthoritativePlayerState{
 if(!Number.isSafeInteger(input.sequence)||input.sequence<=state.lastInputSequence)throw new Error("STALE_INPUT_SEQUENCE");
 for(const value of [input.forward,input.strafe,input.turn,deltaSeconds,nowMs])if(!Number.isFinite(value))throw new Error("INVALID_MOVEMENT_INPUT");
 if(Math.abs(input.forward)>1||Math.abs(input.strafe)>1||Math.abs(input.turn)>1)throw new Error("MOVEMENT_INPUT_OUT_OF_RANGE");
 const dt=clamp(deltaSeconds,0,0.05);
 const magnitude=Math.hypot(input.forward,input.strafe);
 const normalizer=magnitude>1?1/magnitude:1;
 const forward=input.forward*normalizer;
 const strafe=input.strafe*normalizer;
 const yaw=state.position.yaw+input.turn*TURN_RATE*dt;
 const speed=running?RUN_SPEED:WALK_SPEED;
 const sin=Math.sin(yaw),cos=Math.cos(yaw);
 const dx=(strafe*cos+forward*sin)*speed*dt;
 const dz=(forward*cos-strafe*sin)*speed*dt;
 return {
  position:{
   x:clamp(state.position.x+dx,-MAX_WORLD_COORDINATE,MAX_WORLD_COORDINATE),
   y:state.position.y,
   z:clamp(state.position.z+dz,-MAX_WORLD_COORDINATE,MAX_WORLD_COORDINATE),
   yaw
  },
  lastInputSequence:input.sequence,
  lastUpdatedAt:nowMs
 };
}
