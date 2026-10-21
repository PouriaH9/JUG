const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../components/adaptive-quality.tsx');
const compiled = new Module(filename, module);
compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText, filename);
const {nextQuality} = compiled.exports;
for (const [tier, frameMs, expected] of [[2,30,1],[1,30,0],[0,50,0],[0,16,1],[2,16,2],[1,22,1],[1,25,1],[1,18,1]]) {
  assert.equal(nextQuality(tier, frameMs), expected, `tier ${tier}, ${frameMs}ms`);
}
console.log('Adaptive quality: threshold, hysteresis, and tier bounds passed.');
const {createQualityState,sampleQuality}=compiled.exports;
let state=createQualityState();
assert.deepEqual(sampleQuality(state,1,true,2),{});
for(let n=0;n<180;n++)assert.deepEqual(sampleQuality(state,1/60,true,2),{});
state=createQualityState();
for(let n=0;n<3;n++)assert.deepEqual(sampleQuality(state,.25,true,2),{});
assert.deepEqual(sampleQuality(state,.25,true,2),{tier:0});
for(let n=0;n<10;n++)assert.deepEqual(sampleQuality(state,.25,true,0),{});
assert.deepEqual(sampleQuality(state,.25,true,0),{unavailable:true});
assert.deepEqual(sampleQuality(state,.25,true,0),{}); // Report once.
for(const disabledCase of ['hidden','demand','loading']){
 state=createQualityState();
 for(let n=0;n<30;n++)assert.deepEqual(sampleQuality(state,1,false,0),{},disabledCase);
 assert.equal(state.longFrames,0);
}
state=createQualityState();
for(let n=0;n<3;n++)sampleQuality(state,.25,true,2);
sampleQuality(state,1/60,true,2);
assert.equal(state.longFrames,0); // An isolated burst cannot accumulate later.
state=createQualityState();
for(let n=0;n<130;n++)sampleQuality(state,1/60,true,2);
let downgrade;
for(let n=0;n<70;n++){const result=sampleQuality(state,1/30,true,2);if(result.tier!==undefined)downgrade=result;}
assert.deepEqual(downgrade,{tier:1});
for(let n=0;n<120;n++)assert.deepEqual(sampleQuality(state,1/30,true,1),{}); // Eight-second cooldown.
console.log('Adaptive behavior: isolated gaps, persistent stalls, one-shot fallback, inactive safety, normal downgrade and cooldown passed.');
