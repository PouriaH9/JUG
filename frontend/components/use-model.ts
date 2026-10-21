'use client';

import {use} from 'react';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import assets from './model-assets.json';
import {assetPath} from './preview-client';
import {reportModelProgress,resetModelProgress,type ModelAsset} from './model-progress';

type ModelEntry={promise:Promise<GLTF>;status:'pending'|'ready'|'failed'};
// React and the separate Fiber root read exactly the same promise. Successful
// resources stay alive across chapter changes and retries reuse decoded models.
const models=new Map<ModelAsset,ModelEntry>();

export function preloadModel(asset:ModelAsset):Promise<GLTF> {
  const cached=models.get(asset);
  if(cached)return cached.promise;
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const entry:ModelEntry={status:'pending',promise:undefined as unknown as Promise<GLTF>};
  entry.promise=loader.loadAsync(assetPath(assets[asset].path),event=>reportModelProgress(asset,event)).then(model=>{
    entry.status='ready';
    return model;
  },error=>{
    entry.status='failed';
    throw error;
  });
  // A preload is often speculative; React or the caller still receives the
  // original rejection, while this handler prevents unhandled preload errors.
  void entry.promise.catch(()=>{});
  models.set(asset,entry);
  return entry.promise;
}

export function useModel(asset:ModelAsset):GLTF {
  return use(preloadModel(asset));
}

export function clearFailedModels() {
  for(const [asset,entry] of models)if(entry.status==='failed'){
    models.delete(asset);
    resetModelProgress(asset);
  }
}
