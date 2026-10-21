'use client';

import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';

const Air=dynamic(()=>import('./stage-air'),{ssr:false});

/** Decoration imports and builds its texture only after useful content has painted. */
export default function DeferredAir({quiet=false}:{quiet?:boolean}){
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const device=navigator as Navigator&{connection?:{saveData?:boolean}};
    if(device.connection?.saveData)return;
    let idle:number|undefined;
    const timer=setTimeout(()=>{
      if('requestIdleCallback' in window)idle=window.requestIdleCallback(()=>setReady(true),{timeout:1500});
      else setReady(true);
    },600);
    return()=>{clearTimeout(timer);if(idle!==undefined)window.cancelIdleCallback(idle);};
  },[]);
  return ready?<Air quiet={quiet}/>:null;
}
