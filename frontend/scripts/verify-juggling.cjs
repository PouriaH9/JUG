const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const loaded={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../components/juggling-patterns.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:loaded,exports:loaded.exports});
const {createJugglingController,trickPosition,JUGGLING_TRICKS}=loaded.exports;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const dt=1/120;
let maximumStep=0;
for(let from=0;from<JUGGLING_TRICKS.length;from++)for(let to=0;to<JUGGLING_TRICKS.length;to++){
 const rig=createJugglingController();let previous=null,result,frame=0;
 for(let i=0;i<1500;i++){
  const request=i<480?from:to;
  result=rig.frame(++frame,dt,request);
  assert.equal(rig.frame(frame,dt,request).positions,result.positions);
  result.positions.forEach((p,ball)=>{
   assert([p.x,p.y,p.z].every(Number.isFinite));assert(p.y>=-1e-8&&p.y<=1.1);
   if(previous){const step=distance(p,previous[ball]);maximumStep=Math.max(maximumStep,step);assert(step<.12,`Jump ${from}->${to}: ${step}`);}
  });
  previous=result.positions.map(p=>({...p}));
 }
 assert.equal(result.index,to,`Selection ${to} never reached`);
}
// Input can change repeatedly while balls are in flight or in the handoff.
const rapid=createJugglingController();let previous=null,result;
for(let frame=1;frame<2400;frame++){
 const request=frame<1200?Math.floor(frame/17)%12:7;
 result=rapid.frame(frame,dt,request);
 if(previous)result.positions.forEach((p,b)=>assert(distance(p,previous[b])<.12));
 previous=result.positions.map(p=>({...p}));
}
assert.equal(result.index,7);
assert.equal(createJugglingController().frame(1,dt,0).index,0);
// Long-running patterns must stay continuous at catches, releases, and loop boundaries.
for(let pattern=0;pattern<12;pattern++)for(let ball=0;ball<3;ball++)for(let t=dt;t<12;t+=dt){
 assert(distance(trickPosition(pattern,t,ball),trickPosition(pattern,t-dt,ball))<.12);
}
console.log(`PASS: all 144 pattern handoffs, rapid input, shared-frame stability, catches and releases. Largest step: ${maximumStep.toFixed(4)} at 120 fps.`);

// Solid balls must keep their volume through every pattern and handoff.
const {solidBallPositions}=loaded.exports;
for(const [span,height,radius] of [[.82,2.8,.31],[2.5,3,.5]]){
 for(let pattern=0;pattern<12;pattern++){
  const rig=createJugglingController();let last;
  for(let frame=1;frame<1800;frame++){
   const pose=rig.frame(frame,dt,frame<900?pattern:(pattern+1)%12);
   const solid=solidBallPositions(pose.positions,span,height,radius);
   for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)assert(distance(solid[a],solid[b])>=radius*2-1e-6,'Solid balls intersect');
   solid.forEach((p,i)=>{assert(p.y>=-1e-8,'Catch drops below hands');if(last)assert(distance(p,last[i])<.3,'Contact correction jumps');});
   last=solid;
  }
 }
}
console.log('PASS: depth-lane separation, bottom catches and continuous paths at mobile and desktop scales.');

// Every airborne sample has the same downward acceleration and no horizontal acceleration.
let gravitySamples=0;
for(let pattern=0;pattern<12;pattern++)for(let ball=0;ball<3;ball++)for(let t=.02;t<8;t+=.013){
 const h=.0001;
 const a=trickPosition(pattern,t-h,ball),b=trickPosition(pattern,t,ball),c=trickPosition(pattern,t+h,ball);
 if(Math.min(a.y,b.y,c.y)<.002)continue;
 assert(Math.abs((c.y-2*b.y+a.y)/(h*h)+8/(1.25**2))<1e-5,'Gravity varies during flight');
 assert(Math.abs((c.x-2*b.x+a.x)/(h*h))<1e-5,'Airborne horizontal speed varies');
 gravitySamples++;
}
assert(gravitySamples>1000);
console.log(`PASS: constant gravity and horizontal velocity across ${gravitySamples} airborne samples.`);
