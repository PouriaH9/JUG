'use client';
import {useFrame} from '@react-three/fiber';
import {useRef} from 'react';

export type QualityTier = 0 | 1 | 2;
/** Two-second windows, asymmetric thresholds and cooldown prevent oscillation. */
export function nextQuality(tier:QualityTier, averageMs:number):QualityTier {
  if (averageMs > 25) return Math.max(0,tier-1) as QualityTier;
  if (averageMs < 18) return Math.min(2,tier+1) as QualityTier;
  return tier;
}
export function createQualityState(){return {time:0,frames:0,warmup:2,cooldown:0,longFrames:0,severeTime:0,failed:false};}
/** Pure sampler shared with behavior checks. Disabled means hidden, loading, or demand rendering. */
export function sampleQuality(s:ReturnType<typeof createQualityState>,delta:number,enabled:boolean,tier:QualityTier):{tier?:QualityTier;unavailable?:boolean} {
  if(!enabled){Object.assign(s,createQualityState());return {};}
  if(!Number.isFinite(delta)||delta<=0)return {};
  if(delta>.2){
    s.time=0;s.frames=0;
    s.longFrames++;
    // One isolated resume/decode gap is harmless. Four consecutive visible,
    // active frames below 5 FPS mean the scene needs immediate relief.
    if(s.longFrames<4){s.warmup=2;return {};}
    if(tier>0){s.longFrames=0;s.severeTime=0;s.cooldown=8;return {tier:0};}
    s.severeTime+=Math.min(delta,.5);
    // Give the minimum tier another two seconds before offering the static view.
    if(s.severeTime>=2&&!s.failed){s.failed=true;return {unavailable:true};}
    return {};
  }
  s.longFrames=0;s.severeTime=0;
  if(s.warmup>0){s.warmup-=delta;return {};}
  if(s.cooldown>0){s.cooldown-=delta;return {};}
  s.time+=delta;s.frames++;
  if(s.time<2)return {};
  const next=nextQuality(tier,s.time*1000/s.frames);
  s.time=0;s.frames=0;
  if(next!==tier){s.cooldown=8;return {tier:next};}
  return {};
}
export function AdaptiveQuality({enabled,tier,onChange,onUnavailable}:{enabled:boolean;tier:QualityTier;onChange:(tier:QualityTier)=>void;onUnavailable?:()=>void}) {
  const state=useRef(createQualityState());
  useFrame((_,delta)=>{
    const result=sampleQuality(state.current,delta,enabled&&!document.hidden,tier);
    if(result.tier!==undefined)onChange(result.tier);
    if(result.unavailable)onUnavailable?.();
  });
  return null;
}
