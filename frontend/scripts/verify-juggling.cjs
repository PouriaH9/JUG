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
