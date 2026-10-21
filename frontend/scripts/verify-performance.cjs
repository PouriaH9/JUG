const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.join(__dirname,'..');
const assets=require('../components/model-assets.json');
const loaded={exports:{}};
const code=ts.transpileModule(fs.readFileSync(path.join(root,'components/model-progress.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
vm.runInNewContext(code,{module:loaded,exports:loaded.exports,Set,require(name){if(name==='react')return {useSyncExternalStore:(_,snapshot)=>snapshot()};if(name==='./model-assets.json')return assets;throw Error(name);}});
const {reportModelProgress:report,useModelProgress:value}=loaded.exports;
assert.equal(value('balls'),0);
report('balls',{loaded:Math.ceil(assets.balls.bytes*.4),total:1000,lengthComputable:true});
assert.equal(value('balls'),40);
assert.equal(value('packaging'),0,'Other model downloads must not advance this percentage');
report('balls',{loaded:Math.floor(assets.balls.bytes*.1),total:1000,lengthComputable:true});
assert.equal(value('balls'),40,'Out-of-order callbacks must not move progress backwards');
report('packaging',{loaded:assets.packaging.bytes/2,total:0,lengthComputable:false});
assert.equal(value('packaging'),50,'Missing Content-Length uses the known asset byte size');
report('balls',{loaded:assets.balls.bytes,total:1000,lengthComputable:true});
assert.equal(value('balls'),99,'Download completion must wait for the scene before claiming readiness');
for(const [key,asset] of Object.entries(assets)){
 const buffer=fs.readFileSync(path.join(root,'public',asset.path));
 assert.equal(buffer.length,asset.bytes,'Regenerate the manifest after changing a model');
 assert.equal(buffer.readUInt32LE(0),0x46546c67);
 assert.equal(buffer.readUInt32LE(8),buffer.length);
 const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
 assert(json.extensionsRequired.includes('EXT_meshopt_compression'));
 assert(json.buffers.every(b=>!b.uri),'Models must remain self-contained');
 assert(asset.bytes<asset.originalBytes*.4,'Asset size regression');
 if(key==='packaging'){
  assert(json.nodes.some(n=>n.name==='Cap'),'Packing animation needs the named cap');
  assert(!json.nodes.some(n=>/^Packed_Ball_/.test(n.name)),'Do not download hidden duplicate balls');
 }
}
console.log('PASS: byte progress, unknown lengths, isolated downloads, monotonic updates, readiness, compressed asset integrity and size budget.');
assert(assets.mobileBalls.bytes<assets.balls.bytes*.2,'Mobile juggling should avoid the detailed close-up download');
assert(assets.mobileBalls.triangles<assets.balls.triangles*.15,'Mobile geometry budget regressed');
assert(assets.desktopBalls.triangles<assets.balls.triangles*.5,'Desktop juggling should use less geometry than a close-up');
for(const key of ['balls','desktopBalls','mobileBalls']){
 const buffer=fs.readFileSync(path.join(root,'public',assets[key].path));
 const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));
 const nodeNames=json.nodes.map(n=>n.name).filter(Boolean).sort();
 const detailBuffer=fs.readFileSync(path.join(root,'public',assets.balls.path));
 const detailJson=JSON.parse(detailBuffer.subarray(20,20+detailBuffer.readUInt32LE(12)));
 assert.deepEqual(nodeNames,detailJson.nodes.map(n=>n.name).filter(Boolean).sort(),'Ball variants must retain the same named scene structure');
}
report('mobileBalls',{loaded:assets.mobileBalls.bytes/2});
assert.equal(value('mobileBalls'),50,'Mobile progress must track the mobile file');
assert.equal(value('desktopBalls'),0,'Desktop download must remain independent');
console.log('PASS: mobile and desktop geometry budgets, compatible ball nodes and variant progress isolation.');
for(const key of ['mobileBalls','desktopBalls']){
 for(const edge of ['min','max'])for(let i=0;i<3;i++)assert(Math.abs(assets[key].bounds[edge][i]-assets.balls.bounds[edge][i])<.0002,'Variant scene bounds must stay compatible during close-up swapping');
}
console.log('PASS: detailed and juggling variants retain compatible world geometry bounds.');
// The outer page and Fiber root must await the same resource; failed retries
// must not invalidate already-decoded models or leave a permanently rejected cache.
async function verifyModelCache(){
 const pending=[];
 class Loader{
  setMeshoptDecoder(){return this;}
  loadAsync(url,onProgress){return new Promise((resolve,reject)=>pending.push({url,onProgress,resolve,reject}));}
 }
 const mod={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path.join(root,'components/use-model.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2017,esModuleInterop:true}}).outputText;
 const resets=[];
 vm.runInNewContext(source,{module:mod,exports:mod.exports,Map,require(name){
  if(name==='react')return {use:p=>p};
  if(name==='three/addons/loaders/GLTFLoader.js')return {GLTFLoader:Loader};
  if(name==='three/addons/libs/meshopt_decoder.module.js')return {MeshoptDecoder:{}};
  if(name==='./model-assets.json')return assets;
  if(name==='./preview-client')return {assetPath:p=>p};
  if(name==='./model-progress')return {reportModelProgress:()=>{},resetModelProgress:key=>resets.push(key)};
  throw Error(name);
 }});
 const {preloadModel,useModel,clearFailedModels}=mod.exports;
 const first=preloadModel('mobileBalls');
 assert.equal(useModel('mobileBalls'),first,'React and Fiber must share one resource promise');
 assert.equal(preloadModel('mobileBalls'),first,'Do not duplicate in-flight downloads');
 clearFailedModels();
 assert.equal(preloadModel('mobileBalls'),first,'Retry must preserve in-flight resources');
 pending[0].resolve({scene:'ready'});
 await first;
 clearFailedModels();
 assert.equal(preloadModel('mobileBalls'),first,'Retry must preserve decoded successful models');
 const failed=preloadModel('balls');
 pending[1].reject(Error('network failure'));
 await assert.rejects(failed,/network failure/);
 assert.equal(preloadModel('balls'),failed,'Rejected promise remains stable until explicit retry');
 clearFailedModels();
 assert.deepEqual(resets,['balls']);
 const retry=preloadModel('balls');
 assert.notEqual(retry,failed,'Explicit retry must start a fresh download');
 pending[2].resolve({scene:'retry succeeded'});
 await retry;
 console.log('PASS: shared promise cache, decoded model reuse, in-flight stability and failed-download retry.');
}
verifyModelCache().catch(error=>{console.error(error);process.exitCode=1;});

