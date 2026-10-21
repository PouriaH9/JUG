'use client';

import {useSyncExternalStore} from 'react';
import assets from './model-assets.json';

export type ModelAsset = keyof typeof assets;
const progress = Object.fromEntries(Object.keys(assets).map(key=>[key,0])) as Record<ModelAsset,number>;
const listeners = new Set<()=>void>();
const subscribe=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};

// Byte progress is separate for each download. Reserve 100% for a rendered frame.
export function reportModelProgress(asset:ModelAsset,event:ProgressEvent<EventTarget>) {
  // FileLoader counts decoded response bytes; Content-Length may describe gzip bytes.
  const total=assets[asset].bytes;
  const next=Math.max(progress[asset],Math.min(99,Math.floor(event.loaded/total*100)));
  if(next===progress[asset])return;
  progress[asset]=next;
  listeners.forEach(listener=>listener());
}

export function useModelProgress(asset:ModelAsset) {
  return useSyncExternalStore(subscribe,()=>progress[asset],()=>0);
}


export function resetModelProgress(asset:ModelAsset) {
  if(progress[asset]===0)return;
  progress[asset]=0;
  listeners.forEach(listener=>listener());
}
