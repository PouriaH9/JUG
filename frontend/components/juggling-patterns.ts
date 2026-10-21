// Motion references and interpretation notes: ../docs/JUGGLING-REFERENCES.md
export const JUGGLING_TRICKS = ["Cascade","Columns","Mills Mess","Shower","Juggler's Tennis","Box","Reverse Cascade","Windmill","Half-Shower","High-Low Cascade","Reverse Shower","Reverse Half-Shower"] as const;
export type JugglingTrick=typeof JUGGLING_TRICKS[number];
export type Position={x:number;y:number;z:number};
/** Real depth lanes keep full-size balls apart while preserving ballistic X/Y paths.
 * Camera views reveal these lanes; ball scale must not simulate perspective. */
export function solidBallPositions(positions:Position[],span:number,height:number,radius:number):Position[]{
 return positions.map((p,index)=>({x:p.x*span,y:p.y*height,z:(index-1)*radius*2.8}));
}

type Kind='columns'|'cascade'|'shower'|'half'|'tennis'|'mills'|'windmill'|'box'|'highlow';
const CONFIG:{kind:Kind;period:number;reverse?:boolean}[]=[
 {kind:'cascade',period:1.28},
 {kind:'columns',period:1.5},
 {kind:'mills',period:1.35},
 {kind:'shower',period:1.9},
 {kind:'tennis',period:1.35},
 {kind:'box',period:1.5},
 {kind:'cascade',period:1.28,reverse:true},
 {kind:'windmill',period:1.4},
 {kind:'half',period:1.35},
 {kind:'highlow',period:1.4},
 {kind:'shower',period:1.9,reverse:true},
 {kind:'half',period:1.35,reverse:true}
];
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
function delay(pattern:number,ball:number){const c=CONFIG[pattern];return c.kind==='columns'||c.kind==='box'?(ball===1?c.period/2:0):ball*c.period/3;}
function segment(pattern:number,seconds:number,ball:number){
 const c=CONFIG[pattern],elapsed=seconds-delay(pattern,ball);
 const cycle=Math.max(0,Math.floor(elapsed/c.period));
 const e=endpoints(pattern,cycle,ball);
 const amplitude=c.kind==='half'?(e.from<0?1:.66):c.kind==='tennis'?(ball===0?1:.67):c.kind==='highlow'?(cycle%2===0?1:.52):c.kind==='box'&&ball===1?.12:1;
 const split=(c.kind==='windmill'?.76:.82)*Math.sqrt(amplitude);
 if(elapsed<0)return {n:0,u:0,inFlight:false,catchTime:seconds,split,duration:c.period};
 if(c.kind==='shower'){
  const cycle=Math.floor(elapsed/c.period),phase=elapsed-cycle*c.period;
  const high=phase<c.period*.77;
  const split=.88;
  const duration=c.period*(high?.77:.23),start=cycle*c.period+(high?0:c.period*.77);
  const u=(elapsed-start)/duration;
  return {n:cycle*2+(high?0:1),u,inFlight:u<split,catchTime:delay(pattern,ball)+start+duration*split,split,duration};
 }
 const n=Math.floor(elapsed/c.period),u=(elapsed-n*c.period)/c.period;
 return {n,u,inFlight:u<split,catchTime:delay(pattern,ball)+(n+split)*c.period,split,duration:c.period};
}
function endpoints(pattern:number,n:number,ball:number){
 const c=CONFIG[pattern],mirror=c.reverse?-1:1;
 if(c.kind==='columns')return {from:ball-1,to:ball-1,next:ball-1};
 if(c.kind==='box'&&ball!==1)return {from:ball===0?-1:1,to:ball===0?-1:1,next:ball===0?-1:1};
 if(c.kind==='windmill')return {from:-.95,to:.95,next:-.95};
 const sign=c.kind==='shower'?(n%2===0?-1:1):(ball%2===0?-1:1)*(n%2===0?1:-1);
 const outside=c.kind==='cascade'&&c.reverse || c.kind==='tennis'&&ball===0;
 return {from:mirror*sign*(outside?1.08:.8),to:-mirror*sign*(outside?.75:1),next:-mirror*sign*(outside?1.08:.8)};
}
/** Continuous throw/catch paths; every change of pattern is routed through y=0. */
export function trickPosition(pattern:number,seconds:number,ball:number):Position{
 const c=CONFIG[pattern],s=segment(pattern,seconds,ball),e=endpoints(pattern,s.n,ball);
 if(seconds<=delay(pattern,ball))return {x:e.from,y:0,z:0};
 const u=clamp(s.u/s.split);
 if(!s.inFlight)return {x:e.to+(e.next-e.to)*smooth((s.u-s.split)/(1-s.split)),y:0,z:0};
 // Same gravity for every throw: height = g * flightDuration squared / 8.
 // Horizontal velocity stays constant while the ball is airborne.
 const flightDuration=s.duration*s.split;
 const apex=(flightDuration/1.25)**2;
 const x=e.from+(e.to-e.from)*u;
 const y=4*apex*u*(1-u),z=0;
 return {x,y,z};
}

export function createJugglingController(){
 let active=0,target=0,time=0,lastFrame=-1;
 let mode:'running'|'catching'|'transfer'='running',transferTime=0;
 let catches=[0,0,0];let from:Position[]=[];
 let positions=[0,1,2].map(ball=>trickPosition(0,0,ball));
 return {
  frame(frame:number,delta:number,requested:number,reduced=false){
   if(frame===lastFrame)return {index:active,positions,time};lastFrame=frame;
   const dt=Math.min(Math.max(delta,0),.04);
   requested=((Math.round(requested)%CONFIG.length)+CONFIG.length)%CONFIG.length;
   if(reduced){active=requested;mode='running';time=0;positions=[0,1,2].map(ball=>trickPosition(active,0,ball));return {index:active,positions,time};}
   if(mode==='running'&&requested!==active){
    target=requested;
    catches=[0,1,2].map(ball=>{const s=segment(active,time,ball);return s.inFlight?s.catchTime:time;});
    mode='catching';
   }
   if(mode==='running'){
    if(!reduced)time+=dt;
    positions=[0,1,2].map(ball=>trickPosition(active,time,ball));
   }else if(mode==='catching'){
    target=requested;time+=dt;
    positions=[0,1,2].map(ball=>trickPosition(active,Math.min(time,catches[ball]),ball));
    if(time>=Math.max(...catches)){
     from=positions.map(p=>({...p,y:0}));transferTime=0;mode='transfer';
    }
   }else{
    transferTime+=dt;const weight=smooth(transferTime/.55);
    positions=from.map((p,ball)=>{const to=trickPosition(target,0,ball);return {x:p.x+(to.x-p.x)*weight,y:0,z:p.z*(1-weight)};});
    if(transferTime>=.55){active=target;time=0;mode='running';positions=[0,1,2].map(ball=>trickPosition(active,0,ball));}
   }
   return {index:active,positions,time};
  }
 };
}
export type JugglingController=ReturnType<typeof createJugglingController>;
