import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const toolRequire=createRequire(path.join(process.env.JUG_MODEL_TOOLS||process.cwd(),'package.json'));
const load=name=>import(pathToFileURL(toolRequire.resolve(name)).href);
const [{NodeIO},{ALL_EXTENSIONS},{dedup,prune,weld,simplify,meshopt,textureCompress,getBounds},{MeshoptEncoder,MeshoptDecoder,MeshoptSimplifier},{default:sharp}]=await Promise.all(['@gltf-transform/core','@gltf-transform/extensions','@gltf-transform/functions','meshoptimizer','sharp'].map(load));
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready,MeshoptSimplifier.ready]);
const root=fileURLToPath(new URL('../',import.meta.url));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
// Keep the original files and named scene nodes; all variants share compatible bounds.
const entries=[
 ['balls','jug-red-ball-web.glb','jug-red-ball-detail.glb',.5,1024,.0005,85],
 ['desktopBalls','jug-red-ball-web.glb','jug-red-ball-desktop.glb',.25,768,.002,82],
 ['mobileBalls','jug-red-ball-web.glb','jug-red-ball-mobile.glb',.08,512,.006,78],

];
const stats=JSON.parse(fs.readFileSync(path.join(root,'components/model-assets.json'),'utf8'));
for(const [key,source,dest,ratio,resolution,error,quality] of entries){
 const doc=await io.read(path.join(root,'public/assets',source));
 if(key==='packaging')for(const node of doc.getRoot().listNodes())if(/^Packed_Ball_/.test(node.getName()))node.dispose();
 await doc.transform(dedup(),prune(),weld(),simplify({simplifier:MeshoptSimplifier,ratio,error}),textureCompress({encoder:sharp,resize:[resolution,resolution],targetFormat:'webp',quality}),meshopt({encoder:MeshoptEncoder,level:'medium'}));
 await io.write(path.join(root,'public/assets',dest),doc);
 const vertices=doc.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().reduce((n,p)=>n+(p.getAttribute('POSITION')?.getCount()||0),0),0);
 const triangles=doc.getRoot().listMeshes().reduce((sum,mesh)=>sum+mesh.listPrimitives().reduce((n,p)=>n+(p.getIndices()?.getCount()||p.getAttribute('POSITION')?.getCount()||0)/3,0),0);
 stats[key]={path:'/assets/'+dest,bytes:fs.statSync(path.join(root,'public/assets',dest)).size,originalBytes:fs.statSync(path.join(root,'public/assets',source)).size,vertices,triangles,bounds:getBounds(doc.getRoot().listScenes()[0])};
 console.log(key,stats[key]);
}
fs.writeFileSync(path.join(root,'components/model-assets.json'),JSON.stringify(stats,null,2)+'\n');


