// Motion references and interpretation notes: ../docs/JUGGLING-REFERENCES.md
export const JUGGLING_TRICKS = ['Columns','Cascade','Reverse Cascade','Shower','Reverse Shower','Half-Shower','Reverse Half-Shower',"Juggler's Tennis",'Mills Mess','Windmill','Box','High-Low Cascade'] as const;
export type JugglingTrick=typeof JUGGLING_TRICKS[number];
export type Position={x:number;y:number;z:number};
type Kind='columns'|'cascade'|'shower'|'half'|'tennis'|'mills'|'windmill'|'box'|'highlow';
const CONFIG:{kind:Kind;period:number;reverse?:boolean}[]=[
 {kind:'columns',period:1.5},{kind:'cascade',period:1.28},{kind:'cascade',period:1.28,reverse:true},
 {kind:'shower',period:1.9},{kind:'shower',period:1.9,reverse:true},{kind:'half',period:1.35},
 {kind:'half',period:1.35,reverse:true},{kind:'tennis',period:1.35},{kind:'mills',period:1.35},
 {kind:'windmill',period:1.4},{kind:'box',period:1.5},{kind:'highlow',period:1.4}
];
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
function liftAt(u:number){
 const edge=.12,t=Math.min(clamp(u),1-clamp(u));
 if(t>=edge)return 4*u*(1-u);
 const q=t/edge,p=4*edge*(1-edge),v=(4-8*edge)*edge,a=-8*edge*edge;
 return (10*p-4*v+a/2)*q**3+(-15*p+7*v-a)*q**4+(6*p-3*v+a/2)*q**5;
}
function delay(pattern:number,ball:number){const c=CONFIG[pattern];return c.kind==='columns'||c.kind==='box'?(ball===1?c.period/2:0):ball*c.period/3;}
function segment(pattern:number,seconds:number,ball:number){
 const c=CONFIG[pattern],elapsed=seconds-delay(pattern,ball);
 const split=c.kind==='windmill'?.7:.88;
 if(elapsed<0)return {n:0,u:0,inFlight:false,catchTime:seconds,split};
 if(c.kind==='shower'){
  const cycle=Math.floor(elapsed/c.period),phase=elapsed-cycle*c.period;
  const high=phase<c.period*.77;
  const duration=c.period*(high?.77:.23),start=cycle*c.period+(high?0:c.period*.77);
  const u=(elapsed-start)/duration;
  return {n:cycle*2+(high?0:1),u,inFlight:u<split,catchTime:delay(pattern,ball)+start+duration*split,split};
 }
 const n=Math.floor(elapsed/c.period),u=(elapsed-n*c.period)/c.period;
 return {n,u,inFlight:u<split,catchTime:delay(pattern,ball)+(n+split)*c.period,split};
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
 const u=clamp(s.u/s.split),arc=liftAt(u),travel=smooth(u);
 if(!s.inFlight)return {x:e.to+(e.next-e.to)*smooth((s.u-s.split)/(1-s.split)),y:0,z:0};
 let x=e.from+(e.to-e.from)*travel,y=arc,z=0;
 if(c.kind==='shower')y*=s.n%2===0?1.05:.14;
 if(c.kind==='half')y*=e.from<0?1.04:.66;
 if(c.kind==='tennis')y*=ball===0?1.08:.67;
 if(c.kind==='highlow')y*=s.n%2===0?1.05:.52;
 if(c.kind==='box')y*=ball===1?.12:1;
 if(c.kind==='mills'){x+=(s.n%2===0?1:-1)*.32*Math.sin(2*Math.PI*travel)*arc;z=(e.from<0?1:-1)*.5*arc;}
 else if(c.kind==='windmill'){x+=.12*Math.sin(Math.PI*travel)*arc;z=.25*arc;}
 else if(c.kind!=='columns'&&c.kind!=='box')z=(e.from<0?1:-1)*.25*arc;
 return {x,y,z};
}
export function createJugglingController(){
 let active=0,target=0,time=0,lastFrame=-1;
 let mode:'running'|'catching'|'transfer'='running',transferTime=0;
 let catches=[0,0,0];let from:Position[]=[];
 let positions=[0,1,2].map(ball=>trickPosition(0,0,ball));
 return {
  frame(frame:number,delta:number,requested:number,reduced=false){
   if(frame===lastFrame)return {index:active,positions};lastFrame=frame;
   const dt=Math.min(Math.max(delta,0),.04);
   requested=((Math.round(requested)%CONFIG.length)+CONFIG.length)%CONFIG.length;
   if(reduced){active=requested;mode='running';time=0;positions=[0,1,2].map(ball=>trickPosition(active,0,ball));return {index:active,positions};}
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
   return {index:active,positions};
  }
 };
}
export type JugglingController=ReturnType<typeof createJugglingController>;
