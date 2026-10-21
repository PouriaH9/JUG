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
 ['balls','jug-brown-ball-web.glb','jug-brown-ball-optimized.glb',.5,1024,.0005,85],
 ['desktopBalls','jug-brown-ball-web.glb','jug-brown-ball-desktop.glb',.25,768,.002,82],
 ['mobileBalls','jug-brown-ball-web.glb','jug-brown-ball-mobile.glb',.08,512,.006,78],
 ['packaging','jug-packaging-gold-cap-logo.glb','jug-packaging-optimized.glb',.65,1024,.0005,85]
];
const stats={};
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

// Responsive raster copies preserve source alpha and avoid lossless logo payloads.
for(const size of [512,1024]){
 const source=path.join(root,'public/assets',`jug-logo-3d-front-${size}.webp`);
 const output=path.join(root,'public/assets',`jug-logo-3d-front-${size}-optimized.webp`);
 await sharp(source).webp({quality:80,alphaQuality:90,effort:6}).toFile(output);
 const info=await sharp(output).metadata();
 if(info.width!==size||info.height!==size||!info.hasAlpha)throw Error('Logo dimensions or transparency changed');
 console.log('logo',size,{sourceBytes:fs.statSync(source).size,bytes:fs.statSync(output).size,width:info.width,height:info.height,alpha:info.hasAlpha});
}
