'use client';

import dynamic from 'next/dynamic';
import {Component,useCallback,useState,type ReactNode} from 'react';
import {useLanguage} from './language';
import BrandLogo3D from './brand-logo-3d';
import JugglingLoader from './juggling-loader';

function ModuleLoading(){
  const {language,t}=useLanguage();
  return <div className="hero-loading"><BrandLogo3D priority/><JugglingLoader label={t('Loading leather ball models')} progress={0}/></div>;
}
const Scene=dynamic(()=>import('./hero-scene'),{ssr:false,loading:ModuleLoading});

class SceneBoundary extends Component<{children:ReactNode;onError:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onError();}
  render(){return this.state.failed?null:this.props.children;}
}

export default function HeroExperience({onSeeOptions,introPhase=3}:{onSeeOptions:()=>void;introPhase?:number}){
  const {language,t}=useLanguage();
  const [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const unavailable=useCallback(()=>setFailed(true),[]);
  const retry=async()=>{
    const {clearFailedModels}=await import('./use-model');
    clearFailedModels();
    setFailed(false);setAttempt(n=>n+1);
  };
  return <div className="hero-experience">
    {failed?<div className="hero-scene-error" role="status">
      <p>{language==='fa'?'نمای سه‌بعدی بارگذاری نشد.':'The 3D scene could not load.'}</p>
      <button className="button" onClick={retry}>{language==='fa'?'تلاش دوباره':'Try again'}</button>
      <button className="button orange" onClick={onSeeOptions}>{t('The collection')}</button>
    </div>:<SceneBoundary key={attempt} onError={unavailable}><Scene onSeeOptions={onSeeOptions} introPhase={introPhase} onUnavailable={unavailable}/></SceneBoundary>}
  </div>;
}
