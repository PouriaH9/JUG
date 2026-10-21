'use client';
import DeferredAir from './deferred-air';
import {AdaptiveQuality, type QualityTier} from './adaptive-quality';
import type {ModelAsset} from './model-progress';
import {useModel,preloadModel} from './use-model';
import {useModelProgress} from './model-progress';
import BrandLogo3D from './brand-logo-3d';
import JugglingLoader from './juggling-loader';
import HeroCaption from './hero-caption';
import EmojiAccent from './emoji-accent';
import {pagePath} from './preview-client';
import {useLanguage} from './language';
import {createJugglingController, type JugglingController, JUGGLING_TRICKS} from './juggling-patterns';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { AnimatePresence, motion, animate, useMotionValue, useSpring, useReducedMotion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { Component, Suspense, useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box3, Vector3, Euler, Quaternion, FrontSide, MeshStandardMaterial, type Group, type Mesh, type MeshPhysicalMaterial } from 'three';

const PACKAGING = {height:.13,width:.072,centerY:.065,ballRadius:.0215,firstBallY:.0265,ballStep:.0354,ballOffset:.0105};
const packagingFit=(height:number,width:number)=>Math.min(height*.45/PACKAGING.height,width*.55/PACKAGING.width);

function ProductDetails({visible,reduced,language}:{visible:boolean;reduced:boolean;language:string}) {
  const fa=language==='fa';
  const specs=fa?[
    ['قطر','۶','سانتی‌متر'],['وزن هر توپ','۱۰۰','گرم'],['جنس','چرم بز','']
  ]:[['Diameter','6','cm'],['Weight per ball','100','g'],['Material','Goat leather','']];
  return <motion.section className="product-detail-scene" aria-label={fa?'مشخصات مدل S':'Model S product details'} aria-hidden={!visible} inert={!visible}
    initial={false} animate={{opacity:visible?1:0}} transition={{duration:reduced?0:.45}}>
    <motion.div className="product-detail-heading" initial={false} animate={{opacity:visible?1:0,y:visible||reduced?0:12}} transition={{duration:reduced?0:.7,delay:visible&&!reduced?.15:0}}>
      <h2 lang="en" dir="ltr"><span className="product-model-label">Model</span> <span className="product-model-letter">S</span></h2>
    </motion.div>
    <dl className="product-detail-specs">{specs.map(([label,value,unit],index)=><motion.div key={label} className={`product-detail-spec spec-${index}`} initial={false}
      animate={{opacity:visible?1:0,y:visible||reduced?0:14}} transition={{duration:reduced?0:.65,delay:visible&&!reduced?.3+index*.075:0,ease:[.22,1,.36,1]}}>
      <dt>{label}</dt><dd><span>{value}</span>{unit&&<small>{unit}</small>}</dd>
    </motion.div>)}</dl>
    <motion.p className="product-detail-description" dir={fa?'rtl':'ltr'} initial={false} animate={{opacity:visible?1:0,y:visible||reduced?0:8}} transition={{duration:reduced?0:.6,delay:visible&&!reduced?.55:0}}>{fa?'توپ های مخصوص جاگلینگ با کیفیت حرفه ای':'Top-quality balls made for juggling'}<EmojiAccent>✨</EmojiAccent></motion.p>
  </motion.section>;
}

function LeatherBall({ entrance, launch, horizontal, vertical, index, reduced, progress, packing, onTrickChange, rig, requested, modelAsset, mobile }: { mobile:boolean; modelAsset:ModelAsset; entrance:MotionValue<number>; launch:MotionValue<number>; rig:JugglingController; requested:MotionValue<number>; onTrickChange:(index:number)=>void; packing: MotionValue<number>; horizontal: MotionValue<number>; vertical: MotionValue<number>; index: number; reduced: boolean; progress: MotionValue<number> }) {
  const { scene } = useModel(modelAsset);
  const { viewport, invalidate } = useThree();
  const ref = useRef<Group>(null);
  const exitPose=useRef<{position:Vector3; quaternion:Quaternion; scale:number}|null>(null);
  const livePose=useMemo(()=>({position:new Vector3(),quaternion:new Quaternion()}),[]);
  const scratch=useMemo(()=>({position:new Vector3(),quaternion:new Quaternion(),rest:new Vector3(),approach:new Vector3(),jarRotation:new Euler(.08,-.6,0)}),[]);
  const showcaseAngle = useRef(0);
  const lastTrick = useRef(-1);
  const animationTime = useRef(0);
  const showcasePose = useMemo(() => ({ euler: new Euler(), quaternion: new Quaternion() }), []);
  const radius = Math.min(viewport.width * .068, viewport.height * .06);
  const { object, scale, center } = useMemo(() => {
    const object = scene.clone(true);
    if(mobile)object.traverse(node=>{const mesh=node as Mesh;if(!mesh.isMesh)return;
      const simplify=(source:MeshPhysicalMaterial)=>new MeshStandardMaterial({color:source.color,map:source.map,normalMap:source.normalMap,normalScale:source.normalScale,roughnessMap:source.roughnessMap,roughness:source.roughness,metalness:source.metalness,metalnessMap:source.metalnessMap,side:source.side,envMapIntensity:source.envMapIntensity});
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(m=>simplify(m as MeshPhysicalMaterial)):simplify(mesh.material as MeshPhysicalMaterial);
    });
    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    return { object, scale: 2 / Math.max(size.x, size.y, size.z), center: bounds.getCenter(new Vector3()) };
  }, [scene,mobile]);
  useEffect(()=>()=>{if(mobile)object.traverse(node=>{const mesh=node as Mesh;if(mesh.isMesh)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());});},[object,mobile]);
  useEffect(() => {
    const offLaunch=launch.on('change',()=>invalidate());
    const offRequest=requested.on('change',()=>invalidate());
    const offX = horizontal.on('change', () => invalidate());
    const offY = vertical.on('change', () => invalidate());
    const offPacking = packing.on('change', () => invalidate());
    const offProgress = progress.on('change', () => invalidate());
    return () => { offLaunch(); offX(); offY(); offProgress(); offPacking(); offRequest(); };
  }, [horizontal, vertical, progress, packing, requested, launch, invalidate]);
  useFrame(({clock}, delta) => {
    if (!ref.current) return;
    const span=viewport.width*.18;
    // Reserve the upper band for the trick name and keep the full throw below it.
    const height=Math.min(viewport.height*.22,viewport.width*.55);
    const frame=rig.frame(clock.elapsedTime,delta,requested.get(),reduced);
    const trick=frame.positions[index];
    const solidX=trick.x*span, solidY=trick.y*height, solidZ=(index-1)*radius*1.12*2.8;
    // Angular momentum is steady in flight; the invisible hand arrests it at the catch.
    if(!reduced&&trick.y>1e-6&&launch.get()===0)animationTime.current+=Math.min(delta,.04)*1.65;
    const spin=animationTime.current+index*1.2;
    ref.current.position.set(solidX,viewport.height*.025+solidY,solidZ);
    if(index===0 && lastTrick.current!==frame.index){lastTrick.current=frame.index;onTrickChange(frame.index);}
    livePose.position.copy(ref.current.position);
    const flight=launch.get();
    // Rejoin the current juggling orbit, rather than the pose captured seconds ago.
    const handoff=Math.min(1,Math.max(0,flight/.35));
    const rejoin=1-handoff*handoff*(3-2*handoff);
    // Alternating off-screen throws settle into the moving juggling pose with zero
    // residual offset and velocity at the handoff, avoiding a visible snap.
    if(!reduced && entrance.get()<1 && flight===0 && packing.get()===0){
      const t=Math.min(1,Math.max(0,(entrance.get()*2.15-index*.32)/1.5));
      const remaining=1-t;
      const side=index===1?1:-1;
      const startX=side*(viewport.width*.5+radius*2);
      const offset=remaining*remaining*remaining;
      ref.current.position.x+=(startX-solidX)*offset;
      ref.current.position.y+=-viewport.height*.15*offset+viewport.height*.6*t*remaining*remaining;
      ref.current.position.z+=.8*offset;
    }
    // Keep the original juggling ball and capture its pose at the start of the zoom.
    if(flight<=0)exitPose.current=null;
    if(flight>0&&!exitPose.current)exitPose.current={position:ref.current.position.clone(),quaternion:ref.current.quaternion.clone(),scale:ref.current.scale.x};
    if(index!==0){
      const t=Math.min(1,Math.max(0,flight/.58));
      ref.current.visible=flight<.58;
      ref.current.scale.setScalar(radius*scale*(1+.35*t));
      ref.current.rotation.set(spin*.55+t*(index+1)*2,spin*.8+t*(index===1?-7:6),spin*.3+t*(index===1?-3:3));
      if(exitPose.current){
        ref.current.position.copy(exitPose.current.position).lerp(livePose.position,rejoin);
        ref.current.position.x+=(index===1?-1:1)*viewport.width*1.15*(.35*t+.65*t*t);
        ref.current.position.y+=viewport.height*((index===2?1.5:1.1)*t-.6*t*t);
        ref.current.position.z+=t*(index===2?1.2:.5);
      }
      if(packing.get()===0)return;
    }
    const overall = Math.min(1, Math.max(flight*.25, progress.get()));
    const pack = packing.get();
    ref.current.visible = index === 0 || overall < .3 || pack > .48;
    const transition = Math.min(1, overall * 4);
    const leather = Math.min(1, Math.max(0, (overall - .25) * 4));
    const stitch = Math.min(1, Math.max(0, overall * 4 - 2));
    const leatherMix = leather * leather * (3 - 2 * leather);
    const leatherDetail = leather;
    const leatherDetailMix = leatherDetail * leatherDetail * (3 - 2 * leatherDetail);
    const stitchMix = stitch * stitch * (3 - 2 * stitch);
    const mix = transition * transition * (3 - 2 * transition);
    if (index === 0) {
      ref.current.position.x *= 1 - mix;
      ref.current.position.y += ((mobile ? viewport.height * .07 : 0) - ref.current.position.y) * mix;
      ref.current.position.z *= 1 - mix;
      ref.current.position.x -= viewport.width * .12 * leatherMix;
      ref.current.position.y += viewport.height * .23 * leatherMix;
    } else {
      ref.current.position.x += (index === 1 ? -1 : 1) * viewport.width * mix;
      ref.current.position.y += viewport.height * .35 * mix;
    }
    ref.current.scale.setScalar(radius * scale * (index === 0 ? (1 + 2.6 * mix + 3.8 * leatherMix + 2.4 * leatherDetailMix + 5 * stitchMix) : (1 - .45 * mix)));
    ref.current.rotation.set(
      vertical.get() + spin * (index === 1 ? -.55 : .55),
      horizontal.get() + index * 1.2 + spin * (index === 2 ? -.8 : .8),
      -.35 + spin * .3
    );
    livePose.quaternion.copy(ref.current.quaternion);
    if (index === 0) {
      // Product showcase: one steady revolution in about 18 seconds.
      if (!reduced) showcaseAngle.current += Math.min(delta, .05) * .35 * mix * (1 - leatherMix);
      showcasePose.euler.set(.2 + vertical.get() - .35, (showcaseAngle.current + horizontal.get()) * (1 - leatherMix) + (-.6 + horizontal.get() + .6) * leatherMix + .65 * stitchMix, -.12);
      showcasePose.quaternion.setFromEuler(showcasePose.euler);
      ref.current.quaternion.slerp(showcasePose.quaternion, mix);
    }

    if(index===0 && pack===0 && exitPose.current){
      const t=Math.min(1,Math.max(0,flight));
      const zoom=t*t*(3-2*t);
      ref.current.position.lerpVectors(exitPose.current.position,scratch.position.copy(ref.current.position),zoom);
      ref.current.scale.setScalar(exitPose.current.scale+(ref.current.scale.x-exitPose.current.scale)*zoom);
      ref.current.quaternion.slerpQuaternions(exitPose.current.quaternion,scratch.quaternion.copy(ref.current.quaternion),zoom);
      ref.current.position.lerp(livePose.position,rejoin);
      ref.current.scale.setScalar(ref.current.scale.x+(radius*scale-ref.current.scale.x)*rejoin);
      ref.current.quaternion.slerp(livePose.quaternion,rejoin);
    }
    if (pack > 0) {
      const clamp = (v:number) => Math.min(1,Math.max(0,v));
      const smooth = (v:number) => { const t=clamp(v);return t*t*(3-2*t); };
      const fit=packagingFit(viewport.height,viewport.width);
      const jarRotation=scratch.jarRotation;
      const impact=(start:number)=>{const t=clamp((pack-start)/.045);return 4*t*(1-t);};
      // Round balls retain uniform scale; alternating positions make a close stack.
      const rest=scratch.rest.set(index===1?PACKAGING.ballOffset:-PACKAGING.ballOffset,PACKAGING.firstBallY+index*PACKAGING.ballStep-PACKAGING.centerY,0).applyEuler(jarRotation).multiplyScalar(fit);
      rest.y+=viewport.height*.14;
      const ballRadius=PACKAGING.ballRadius*fit;
      if(index===0) {
        const zoom=smooth(pack/.24);
        const insert=clamp((pack-.34)/.17);
        const approach=scratch.approach.set(0,viewport.height*.43,0);
        ref.current.position.lerp(approach,zoom);
        ref.current.scale.setScalar(ref.current.scale.x+(ballRadius*scale-ref.current.scale.x)*zoom);
        const settle=pack>.51?impact(.51)*ballRadius*.035:0;
        ref.current.position.lerp(rest,insert*insert);
        ref.current.position.y+=settle;
      } else {
        const start=index===1?.5:.68;
        const fall=clamp((pack-start)/.15);
        ref.current.visible=pack>=start;
        const top=viewport.height*.65;
        // Ballistic fall and a short low rebound: leather absorbs most of the impact.
        const bounce=pack>start+.15 ? impact(start+.15)*ballRadius*.09 : 0;
        ref.current.position.set(rest.x,top+(rest.y-top)*fall*fall+bounce,rest.z);
        ref.current.scale.setScalar(ballRadius*scale);
        ref.current.rotation.set(.3+fall*1.2,index*.7+fall*2,fall*.4);
      }
    }
  });
  return <>
    <group ref={ref} position={[0, viewport.height * .25, 0]} scale={radius * scale} rotation={[.35, -.6, -.35]}>
      <primitive object={object} position={[-center.x, -center.y, -center.z]} />
    </group>

  </>;
}


type PackageView = {yaw:MotionValue<number>;pitch:MotionValue<number>;zoom:MotionValue<number>};

function PackageInspectionRig({view,children,centerY=.14}:{view:PackageView;children:ReactNode;centerY?:number}) {
  const ref=useRef<Group>(null);
  const {viewport,invalidate}=useThree();
  useEffect(()=>{
    const off=Object.values(view).map(value=>value.on('change',()=>invalidate()));
    return ()=>off.forEach(unsubscribe=>unsubscribe());
  },[view,invalidate]);
  useFrame((_,delta)=>{
    if(!ref.current)return;
    ref.current.rotation.set(view.pitch.get(),view.yaw.get(),0);
    const target=view.zoom.get();
    const next=ref.current.scale.x+(target-ref.current.scale.x)*(1-Math.exp(-12*Math.min(delta,.05)));
    const settled=Math.abs(target-next)<.0001;
    ref.current.scale.setScalar(settled?target:next);
    if(!settled)invalidate();
  });
  return <group position={[0,viewport.height*centerY,0]}><group ref={ref}><group position={[0,-viewport.height*centerY,0]}>{children}</group></group></group>;
}

function PackageGestures({view,subject='packaging'}:{view:PackageView;subject?:'packaging'|'ball'}) {
  const {t,language}=useLanguage();
  const ref=useRef<HTMLDivElement>(null);
  const subjectLabel=language==='fa'?(subject==='ball'?'توپ':'بسته‌بندی'):subject;
  const held=useRef(false);
  const holdPointer=useRef<{id:number;x:number;y:number}|null>(null);
  const [holding,setHolding]=useState(false);
  const zoomTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const [zoomHolding,setZoomHolding]=useState<number|null>(null);
  const releaseZoom=()=>{if(zoomTimer.current!==null)clearInterval(zoomTimer.current);zoomTimer.current=null;setZoomHolding(null);};
  useEffect(()=>{window.addEventListener('blur',releaseZoom);return ()=>{window.removeEventListener('blur',releaseZoom);if(zoomTimer.current!==null)clearInterval(zoomTimer.current);};},[]);
  const releaseHold=()=>{held.current=false;holdPointer.current=null;setHolding(false);};
  useEffect(()=>{window.addEventListener('blur',releaseHold);return ()=>window.removeEventListener('blur',releaseHold);},[]);
  const reset=()=>{view.yaw.set(0);view.pitch.set(0);view.zoom.set(1);};
  const zoom=(factor:number)=>view.zoom.set(Math.max(.4,Math.min(5.4,view.zoom.get()*factor)));
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    type TouchPose={x:number;y:number;distance:number};
    let previous:TouchPose|null=null;
    const pose=(touches:TouchList):TouchPose=>({
      x:(touches[0].clientX+touches[1].clientX)/2,
      y:(touches[0].clientY+touches[1].clientY)/2,
      distance:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY),
    });
    const currentPose=(event:TouchEvent):TouchPose|null=>{
      if(held.current&&event.targetTouches.length===1){const touch=event.targetTouches[0];return {x:touch.clientX,y:touch.clientY,distance:0};}
      return event.touches.length===2?pose(event.touches):null;
    };
    const start=(event:TouchEvent)=>{
      previous=currentPose(event);
      element.dataset.dragging=String(previous!==null);
      if(previous){event.preventDefault();event.stopPropagation();}
    };
    const move=(event:TouchEvent)=>{
      const next=currentPose(event);
      if(!next){previous=null;return;}
      event.preventDefault();event.stopPropagation();
      if(previous){
        view.yaw.set(view.yaw.get()+(next.x-previous.x)*.009);
        view.pitch.set(Math.max(-Math.PI/2,Math.min(Math.PI/2,view.pitch.get()+(next.y-previous.y)*.009)));
        if(previous.distance>2&&next.distance>2)zoom(next.distance/previous.distance);
      }
      previous=next;
    };
    const end=(event:TouchEvent)=>{
      previous=currentPose(event);
      element.dataset.dragging=String(previous!==null);
    };
    // Trackpad pinch emits Ctrl+wheel; ordinary scrolling belongs to the page.
    const wheel=(event:WheelEvent)=>{if(!event.ctrlKey)return;event.preventDefault();event.stopPropagation();zoom(Math.exp(-event.deltaY*.002));};
    element.addEventListener('touchstart',start,{passive:false});
    element.addEventListener('touchmove',move,{passive:false});
    element.addEventListener('touchend',end);element.addEventListener('touchcancel',end);
    element.addEventListener('wheel',wheel,{passive:false});
    return ()=>{
      element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);
      element.removeEventListener('touchend',end);element.removeEventListener('touchcancel',end);element.removeEventListener('wheel',wheel);
    };
  },[view]);
  return <div className="hero-package-inspection">
    <div ref={ref} className="hero-package-gesture" style={{touchAction:holding?'none':'pan-y'}} tabIndex={0} role="group" aria-label={subject==='ball'?(language==='fa'?'بررسی توپ':'Explore the ball'):t('Explore the packaging')} onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      if(event.key==='ArrowLeft')view.yaw.set(view.yaw.get()-.15);
      if(event.key==='ArrowRight')view.yaw.set(view.yaw.get()+.15);
      if(event.key==='ArrowUp')view.pitch.set(Math.max(-Math.PI/2,view.pitch.get()-.15));
      if(event.key==='ArrowDown')view.pitch.set(Math.min(Math.PI/2,view.pitch.get()+.15));
      if(event.key==='+'||event.key==='=')zoom(1.12);
      if(event.key==='-')zoom(1/1.12);
      if(event.key==='0')reset();
    }}/>
    <div className="hero-package-actions">
    <button type="button" className="navigation-toggle hero-package-hold" data-holding={holding} aria-label={t('Hold and drag to rotate')} title={t('Hold and drag to rotate')} aria-pressed={holding}
      onPointerDown={event=>{
        if(holdPointer.current||(event.pointerType==='mouse'&&event.button!==0))return;
        event.currentTarget.setPointerCapture(event.pointerId);
        holdPointer.current={id:event.pointerId,x:event.clientX,y:event.clientY};held.current=true;setHolding(true);
      }}
      onPointerMove={event=>{
        const previous=holdPointer.current;if(!previous||previous.id!==event.pointerId)return;
        view.yaw.set(view.yaw.get()+(event.clientX-previous.x)*.012);
        view.pitch.set(Math.max(-Math.PI/2,Math.min(Math.PI/2,view.pitch.get()+(event.clientY-previous.y)*.012)));
        previous.x=event.clientX;previous.y=event.clientY;
      }}
      onPointerUp={event=>{if(holdPointer.current?.id===event.pointerId)releaseHold();}}
      onPointerCancel={releaseHold} onLostPointerCapture={releaseHold} onBlur={releaseHold}
      onTouchStart={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}
      onKeyDown={event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();held.current=true;setHolding(true);}}}
      onKeyUp={event=>{if(event.key===' '||event.key==='Enter')releaseHold();}}>
      <svg viewBox="0 0 64 64" width="36" height="36" fill="none" aria-hidden="true">
        <path d="M12 25C16 10 43 8 53 22M52 15l2 8-8-1M52 39C48 54 21 56 11 42M12 49l-2-8 8 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="32" y="38" textAnchor="middle" fill="currentColor" fontFamily="Arial,sans-serif" fontSize="17" fontWeight="600">360°</text>
      </svg>
    </button>
    {[1,-1].map(direction=><button key={direction} type="button" className="navigation-toggle hero-package-hold hero-package-zoom" data-holding={zoomHolding===direction} aria-label={language==='fa'?(direction===1?'بزرگ‌نمایی ':'کوچک‌نمایی ')+subjectLabel:(direction===1?'Zoom in ':'Zoom out ')+subjectLabel}
      onPointerDown={event=>{
        if(zoomTimer.current!==null||(event.pointerType==='mouse'&&event.button!==0))return;
        event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);setZoomHolding(direction);
        zoom(Math.pow(1.12,direction));
        zoomTimer.current=setInterval(()=>zoom(Math.pow(1.035,direction)),60);
      }}
      onPointerUp={releaseZoom} onPointerCancel={releaseZoom} onLostPointerCapture={releaseZoom} onBlur={releaseZoom}
      onTouchStart={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onTouchEnd={event=>event.stopPropagation()}
      onClick={event=>{if(event.detail===0)zoom(Math.pow(1.12,direction));}}>
      <svg viewBox="0 0 64 64" width="36" height="36" fill="none" aria-hidden="true">
        <circle cx="27" cy="27" r="15" stroke="currentColor" strokeWidth="3.5"/>
        <path d="m38 38 14 14M20 27h14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        {direction===1&&<path d="M27 20v14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>}
      </svg>
    </button>)}
    </div>
  </div>;
}

function PackagingScene({packing,onReady}:{packing:MotionValue<number>;onReady:()=>void}) {
  const {scene}=useModel('packaging');
  useEffect(onReady,[onReady]);
  const {viewport,invalidate}=useThree();
  const ref=useRef<Group>(null);
  const {object,cap,capY}=useMemo(()=>{
    const object=scene.clone(true);
    // Glass needs alpha blending when the studio backdrop comes from CSS.
    object.traverse(child=>{
      const mesh=child as Mesh;
      if(!mesh.isMesh)return;
      const tune=(source:MeshPhysicalMaterial)=>{
        const material=source.clone();
        if(material.transmission>.9){
          material.transparent=true;
          material.opacity=.06;
          // A thin-shell Fresnel finish avoids a second blurry refraction pass.
          // The interior stays clear; grazing angles define the curved glass edge.
          material.transmission=0;
          material.color.set('#8fa69e');
          material.depthWrite=false;
          material.side=FrontSide;
          material.roughness=.06;
          material.ior=1.46;
          material.thickness=.0015;
          material.envMapIntensity=.6;
          material.specularIntensity=.6;
          material.onBeforeCompile=shader=>{
            shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
              float glassEdge = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
              diffuseColor.a = 0.025 + 0.5 * glassEdge;
              #include <opaque_fragment>
            `);
          };
          material.customProgramCacheKey=()=> 'jug-clear-glass-v1';
        }else if(material.metalness>.5){
          material.roughness=.32;
          material.envMapIntensity=.7;
        }
        return material;
      };
      mesh.material=Array.isArray(mesh.material)
        ?mesh.material.map(material=>tune(material as MeshPhysicalMaterial))
        :tune(mesh.material as MeshPhysicalMaterial);
    });
    const cap=object.getObjectByName('Cap');
    [1,2,3].forEach(i=>{const ball=object.getObjectByName('Packed_Ball_'+i);if(ball)ball.visible=false;});
    return {object,cap,capY:cap?.position.y||0};
  },[scene]);
  useEffect(()=>()=>{
    object.traverse(child=>{
      const mesh=child as Mesh;
      if(mesh.isMesh)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());
    });
  },[object]);
  useEffect(()=>packing.on('change',()=>invalidate()),[packing,invalidate]);
  useFrame(()=>{
    if(!ref.current)return;
    const t=packing.get();
    const clamp=(v:number)=>Math.min(1,Math.max(0,v));
    const rise=clamp((t-.16)/.2);const ease=rise*rise*(3-2*rise);
    const fit=packagingFit(viewport.height,viewport.width);
    ref.current.visible=t>.16;
    ref.current.scale.setScalar(fit);
    ref.current.position.set(0,viewport.height*.14-viewport.height*1.1*(1-ease),-.6*(1-ease));
    ref.current.rotation.set(.08,-.6,0);
    if(cap){const close=clamp((t-.86)/.11);cap.position.y=capY+.062*(1-close*close*(3-2*close));}
  });
  return <group ref={ref} visible={false}><primitive object={object} position={[0,-PACKAGING.centerY,0]}/></group>;
}

// Share one shadow pass. On phones the CSS floor supplies the grounding.
function SceneShadows() {
  const {viewport}=useThree();
  return <ContactShadows position={[0,-viewport.height*.4,0]} opacity={.2} scale={viewport.width*1.4} blur={3} far={viewport.height} resolution={256}/>;
}

function SceneFailure(){const {t}=useLanguage();return <div className="hero-model-error" role="status">{t("3D preview unavailable. Please reload to try again.")}</div>;}

class SceneBoundary extends Component<{ children: ReactNode; onError?:()=>void }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(){this.props.onError?.();}
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <SceneFailure/>
      : this.props.children;
  }
}


function ContextLossGuard({onUnavailable}:{onUnavailable?:()=>void}) {
  const gl=useThree(state=>state.gl);
  useEffect(()=>{
    const canvas=gl.domElement;
    const lost=()=>{if(canvas.isConnected)onUnavailable?.();};
    canvas.addEventListener('webglcontextlost',lost);
    return()=>canvas.removeEventListener('webglcontextlost',lost);
  },[gl,onUnavailable]);
  return null;
}

function BallsReady({onReady}:{onReady:()=>void}) {
  const reported=useRef(false);
  useFrame(()=>{if(!reported.current){reported.current=true;onReady();}});
  return null;
}

export default function HeroScene({onSeeOptions,introPhase=3,onUnavailable,onReady}:{onSeeOptions:()=>void;introPhase?:number;onUnavailable?:()=>void;onReady?:()=>void}) {
  const {t}=useLanguage();
  const [ballsReady,setBallsReady]=useState(false);

  const packageProgress=useModelProgress('packaging');
  const {language}=useLanguage();
  const [packageModelReady,setPackageModelReady]=useState(false);
  const markPackageReady=useCallback(()=>setPackageModelReady(true),[]);

  const [sceneFailed,setSceneFailed]=useState(false);
  const [trickVisible,setTrickVisible]=useState(false);
  const markReady=useCallback(()=>{setBallsReady(true);onReady?.();},[onReady]);
  const markFailed=useCallback(()=>setSceneFailed(true),[]);
  useEffect(()=>{
    if(introPhase<3||!ballsReady)return;
    const timer=setTimeout(()=>setTrickVisible(true),500);
    return()=>clearTimeout(timer);
  },[introPhase,ballsReady]);
  const [trickIndex,setTrickIndex]=useState(0);
  const [selectedTrick,setSelectedTrick]=useState(0);

  const requestedTrick=useMotionValue(0);
  const trickInteractionUntil=useRef(0);
  const previousArrow=useRef<HTMLButtonElement>(null);
  const nextArrow=useRef<HTMLButtonElement>(null);
  const downArrow=useRef<HTMLButtonElement>(null);
  const advanceChapter=useRef<()=>boolean>(()=>false);
  const pulseArrow=(direction:number)=>{
    const arrow=(direction<0?previousArrow:nextArrow).current;
    if(!arrow)return;
    arrow.getAnimations().forEach(animation=>animation.cancel());
    arrow.animate([
      {opacity:1,transform:reduced?'none':'scale(1.12)'},
      {opacity:.72,transform:'scale(1)'}
    ],{duration:260,easing:'ease-out'});
  };
  const rig=useMemo(()=>createJugglingController(),[]);
  const [trickArrowsHidden,setTrickArrowsHidden]=useState(false);
  const trickArrowTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(trickArrowTimer.current)clearTimeout(trickArrowTimer.current);},[]);
  const changeTrick=(direction:number)=>{
    if(trickArrowTimer.current)return;
    setTrickArrowsHidden(true);
    trickArrowTimer.current=setTimeout(()=>{trickArrowTimer.current=null;setTrickArrowsHidden(false);},2000);
    pulseArrow(direction);
    trickInteractionUntil.current=Date.now()+1400;
    const next=(requestedTrick.get()+direction+JUGGLING_TRICKS.length)%JUGGLING_TRICKS.length;
    requestedTrick.set(next);setSelectedTrick(next);
  };
  const reduced = useReducedMotion();
  const entrance=useMotionValue(0);
  useEffect(()=>{
    if(introPhase<3||!ballsReady)return;
    if(reduced){entrance.set(1);return;}
    const controls=animate(entrance,1,{duration:2.15,ease:'linear'});
    return()=>controls.stop();
  },[introPhase,ballsReady,reduced,entrance]);
  const story = useRef<HTMLDivElement>(null);
  const [mobileQuality,setMobileQuality]=useState(()=>typeof window==='undefined'||window.matchMedia('(max-width: 720px), (pointer: coarse)').matches);
  const [baseModel]=useState<ModelAsset>(()=>typeof window==='undefined'||window.matchMedia('(max-width: 720px), (pointer: coarse)').matches?'mobileBalls':'desktopBalls');
  const [detailedReady,setDetailedReady]=useState(false);
  const [qualityTier,setQualityTier]=useState<QualityTier>(2);

  const [sceneActive,setSceneActive]=useState(true);
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 720px), (pointer: coarse)');
    const updateQuality=()=>setMobileQuality(media.matches);
    updateQuality();media.addEventListener('change',updateQuality);
    let inView=true;
    const updateActive=()=>setSceneActive(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;updateActive();});
    if(story.current)observer.observe(story.current);
    document.addEventListener('visibilitychange',updateActive);updateActive();
    return()=>{observer.disconnect();media.removeEventListener('change',updateQuality);document.removeEventListener('visibilitychange',updateActive);};
  },[]);
  const { scrollYProgress } = useScroll({ target: story, offset: ['start start', 'end end'] });
  const stageTravel=useTransform(scrollYProgress,[0,.25,.5,.75,1],[0,28,-18,16,0]);
  const stageScale=useTransform(scrollYProgress,[0,.5,1],[1,1.16,.94]);
  const launch=useMotionValue(0);
  const launchTarget=useRef(false);
  const launchAnimation=useRef<ReturnType<typeof animate>|null>(null);
  useMotionValueEvent(scrollYProgress,'change',value=>{
    const next=value>.015;
    if(next===launchTarget.current)return;
    launchTarget.current=next;
    launchAnimation.current?.stop();
    launchAnimation.current=animate(launch,next?1:0,{duration:reduced?0:1.65*Math.abs((next?1:0)-launch.get()),ease:'linear'});
  });
  useEffect(()=>()=>launchAnimation.current?.stop(),[]);
  const packing = useMotionValue(0);
  const packingAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const packingTarget=useRef<0|1>(0);
  const [packingVisible,setPackingVisible]=useState(false);
  const [packagingReady,setPackagingReady]=useState(false);
  const packageYaw=useMotionValue(0),packagePitch=useMotionValue(0),packageZoom=useMotionValue(1);
  const packageView=useMemo(()=>({yaw:packageYaw,pitch:packagePitch,zoom:packageZoom}),[packageYaw,packagePitch,packageZoom]);
  const ballYaw=useMotionValue(0),ballPitch=useMotionValue(0),ballZoom=useMotionValue(1);
  const ballView=useMemo(()=>({yaw:ballYaw,pitch:ballPitch,zoom:ballZoom}),[ballYaw,ballPitch,ballZoom]);
  const viewReturnAnimations=useRef<ReturnType<typeof animate>[]>([]);
  const packingSequence=useRef(0);
  useMotionValueEvent(packing,'change',value=>{
    setPackagingReady(value>=1&&packingTarget.current===1);
    setPackingVisible(value>0);
  });
  useEffect(()=>()=>{packingSequence.current++;packingAnimation.current?.stop();viewReturnAnimations.current.forEach(animation=>animation.stop());},[]);
  useMotionValueEvent(scrollYProgress,'change',value=>{
    const target=value>=.8?1:value<.78?0:packingTarget.current;
    if(target===packingTarget.current)return;
    packingAnimation.current?.stop();
    viewReturnAnimations.current.forEach(animation=>animation.stop());
    const sequence=++packingSequence.current;
    packingTarget.current=target;
    const runPacking=()=>{
      if(sequence!==packingSequence.current)return;
      const remaining=Math.abs(target-packing.get());
      packingAnimation.current=animate(packing,target,{duration:reduced?0:(target===1?2.1:1.8)*remaining,ease:'linear'});
      if(target===1&&packing.get()>=1)setPackagingReady(true);
    };
    if(target===0){
      setPackagingReady(false);
      // Return the complete assembly before reversing the packing timeline.
      // Choose the nearest full turn so a long rotation never unwinds repeatedly.
      const yaw=Math.round(packageYaw.get()/(Math.PI*2))*Math.PI*2;
      const changed=Math.abs(packageYaw.get()-yaw)>.001||Math.abs(packagePitch.get())>.001||Math.abs(packageZoom.get()-1)>.001;
      const duration=reduced||!changed?0:.45;
      viewReturnAnimations.current=[animate(packageYaw,yaw,{duration,ease:'easeInOut'}),animate(packagePitch,0,{duration,ease:'easeInOut'}),animate(packageZoom,1,{duration,ease:'easeInOut'})];
      void Promise.all(viewReturnAnimations.current).then(()=>{
        if(sequence!==packingSequence.current)return;
        packageYaw.set(0);runPacking();
      });
    }else runPacking();
  });
  const [scrollScene,setScrollScene]=useState(0);
  useMotionValueEvent(scrollYProgress,'change',value=>setScrollScene(Math.min(4,Math.floor(value*4+.5))));
  const sceneIndex=packingVisible?4:scrollScene;
  useEffect(()=>{ballYaw.set(0);ballPitch.set(0);ballZoom.set(1);},[sceneIndex,ballYaw,ballPitch,ballZoom]);
  const modelAsset:ModelAsset=sceneIndex>0&&detailedReady?'balls':baseModel;
  useEffect(()=>{
    if(sceneIndex<1||detailedReady)return;
    let cancelled=false;
    void preloadModel('balls').then(()=>{if(!cancelled)setDetailedReady(true);},()=>{/* Keep the usable lightweight scene if detail loading fails. */});
    return()=>{cancelled=true;};
  },[sceneIndex,detailedReady]);
  const renderMode=!sceneActive?'never':(reduced||sceneIndex>=2)?'demand':'always';
  const ballsProgress=useModelProgress(modelAsset);
  useEffect(()=>{
    if(!trickVisible||sceneIndex!==0||reduced||selectedTrick!==trickIndex)return;
    const timer=window.setInterval(()=>{
      if(document.hidden)return;
      const next=(requestedTrick.get()+1)%JUGGLING_TRICKS.length;
      requestedTrick.set(next);
      setSelectedTrick(next);
    },5000);
    return ()=>window.clearInterval(timer);
  },[sceneIndex,selectedTrick,trickIndex,reduced,requestedTrick,trickVisible]);
  // Keep the close-up pose stable until the complete reverse packing timeline finishes.
  const visualProgress=useTransform([scrollYProgress,packing],([scroll,pack])=>Number(pack)>0?Math.max(Number(scroll),.75):Number(scroll));
  const transition=useSpring(visualProgress,{stiffness:90,damping:25});

  const leatherLine = useTransform(scrollYProgress, [.39, .495], [0, 1]);
  const stitchLine = useTransform(scrollYProgress, [.64, .745], [0, 1]);
  useEffect(() => {
    let lockedUntil = 0;
    let navigationUntil = 0;
    const touchDevice=window.matchMedia('(pointer: coarse)').matches;
    let viewportWidth=window.innerWidth;
    let touchStart = 0;
    let touchStartX = 0;
    const stage = story.current?.querySelector<HTMLElement>('.hero-sticky-stage');
    let stageHeight = stage?.clientHeight || window.innerHeight;
    const root = document.documentElement;
    root.style.setProperty('--screen-height', `${window.innerHeight}px`);
    let resizeFrame = 0;
    let resizeTimer:ReturnType<typeof setTimeout> | undefined;
    let resizingUntil = 0;
    let chapterPosition = scrollYProgress.get() * 4;
    const rememberChapter = () => {
      const element = story.current;
      if (!element || !stage || stage.clientHeight !== stageHeight || window.innerHeight !== stageHeight || Date.now()<resizingUntil) return;
      chapterPosition = (window.scrollY - (element.getBoundingClientRect().top + window.scrollY)) / stageHeight;
    };
    const snap = (direction: number) => {
      const element = story.current;
      const reversing=direction<0&&packingTarget.current===1&&packing.get()>0;
      if (!element || (Date.now()<lockedUntil&&!reversing) || Date.now()<navigationUntil) return false;
      const start = element.getBoundingClientRect().top + window.scrollY;
      const end = start + element.offsetHeight - (stage?.clientHeight || window.innerHeight);
      const current = window.scrollY;
      if (current < start - window.innerHeight * .3 || current > end + 4) return false;
      if (direction < 0 && current <= start + 4) return false;
      const step = (end - start) / 4;
      const relative = Math.max(0, (current - start) / step);
      const leavingJar=direction<0&&packing.get()>0;
      const next=leavingJar?3:direction>0?Math.floor(relative+.025)+1:Math.ceil(relative-.025)-1;
      const destination = start + Math.max(0, Math.min(4, next)) * step;
      if (Math.abs(destination - current) < 4) return false;
      lockedUntil=Date.now()+(!reduced&&leavingJar?2300:next===4&&direction>0&&!reduced?2700:next===1&&direction>0&&!reduced?1850:1100);
      window.scrollTo({ top: destination, behavior: reduced ? 'instant' : 'smooth' });
      return true;
    };
    const wheel = (event: WheelEvent) => {
      if((event.target as Element)?.closest('.hero-package-inspection'))return;
      if ((event.target as Element)?.closest('header,.overlay,input,textarea,select') || event.ctrlKey) return;
      if (Math.abs(event.deltaY) < 2 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if(Date.now()<lockedUntil&&!(event.deltaY<0&&packingTarget.current===1&&packing.get()>0)){event.preventDefault();return;}
      if (snap(event.deltaY)) event.preventDefault();
    };
    advanceChapter.current=()=>snap(1);
    let inspectingPackage=false;
    const startTouch = (event: TouchEvent) => { inspectingPackage=!!(event.target as Element)?.closest('.hero-package-inspection');touchStart = event.touches[0]?.clientY ?? 0; touchStartX=event.touches[0]?.clientX??0; };
    const endTouch = (event: TouchEvent) => {
      if(touchDevice||inspectingPackage)return;
      const distance = touchStart - (event.changedTouches[0]?.clientY ?? touchStart);
      const horizontalDistance=touchStartX-(event.changedTouches[0]?.clientX??touchStartX);
      if (Math.abs(distance)>15 && Math.abs(distance)>Math.abs(horizontalDistance)*1.2) snap(distance);
    };
    // Resizing preserves chapter position; scroll events never trigger another snap.
    const resize = () => {
      // Address-bar height changes must not reset the chapter or interrupt a swipe.
      if(touchDevice&&window.innerWidth===viewportWidth)return;
      viewportWidth=window.innerWidth;
      const element = story.current;
      if (!element || !stage) return;
      const start = element.getBoundingClientRect().top + window.scrollY;
      const chapter = chapterPosition;
      root.style.setProperty('--screen-height', `${window.innerHeight}px`);
      const nextHeight = stage.clientHeight;
      stageHeight = nextHeight;
      lockedUntil = 0;
      navigationUntil = Date.now() + 300;
      resizingUntil = Date.now() + 200;
      if (chapter < 0 || chapter > 4) return;
      cancelAnimationFrame(resizeFrame);
      clearTimeout(resizeTimer);
      const restore = () => window.scrollTo({top:start + chapter * nextHeight,behavior:'instant'});
      resizeFrame = requestAnimationFrame(restore);
      // Mobile browsers can apply scroll anchoring after the first layout pass.
      resizeTimer = setTimeout(restore,150);
    };
    const navigation = (event:KeyboardEvent) => { if(['Home','End','PageUp','PageDown'].includes(event.key)) navigationUntil=Date.now()+1800; };
    window.addEventListener('keydown',navigation);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', rememberChapter, {passive:true});
    window.addEventListener('wheel', wheel, { passive: false });
    const guardTouch=(event:TouchEvent)=>{if(!touchDevice&&Date.now()<lockedUntil&&packingTarget.current===0&&packing.get()>0)event.preventDefault();};
    window.addEventListener('touchmove',guardTouch,{passive:false});
    window.addEventListener('touchstart', startTouch, { passive: true });
    window.addEventListener('touchend', endTouch, { passive: true });
    return () => { root.style.removeProperty('--screen-height'); clearTimeout(resizeTimer); cancelAnimationFrame(resizeFrame); window.removeEventListener('scroll',rememberChapter); window.removeEventListener('resize',resize); window.removeEventListener('keydown',navigation); window.removeEventListener('wheel', wheel); window.removeEventListener('touchmove',guardTouch); window.removeEventListener('touchstart', startTouch); window.removeEventListener('touchend', endTouch); };
  }, [reduced]);
  const horizontal = useMotionValue(-.6);
  const vertical = useMotionValue(.35);
  const smoothHorizontal = useSpring(horizontal, { stiffness: 180, damping: 24 });
  const smoothVertical = useSpring(vertical, { stiffness: 180, damping: 24 });
  return <div className="hero-scroll-story" ref={story}><div className="hero-sticky-stage" data-light-chapter={sceneIndex} data-balls-ready={ballsReady} data-render-quality={`${mobileQuality?"mobile":"desktop"}-${qualityTier}`} data-scene-active={sceneActive} data-render-mode={renderMode} data-model-asset={modelAsset}><div className="stage-atmosphere" aria-hidden="true"><div className="stage-beam stage-beam-left"/><div className="stage-beam stage-beam-right"/><div className="stage-halo"/><BrandLogo3D priority/><div className="stage-floor"/><motion.div className="stage-arena" style={{y:reduced?0:stageTravel,scale:reduced?1:stageScale}}><div className="stage-arena-rim"/><div className="stage-arena-inner"/></motion.div><div className="stage-wing stage-wing-left"/><div className="stage-wing stage-wing-right"/><div className="stage-grain"/>{qualityTier>0&&ballsReady&&<DeferredAir/>}</div><SceneBoundary onError={()=>{markFailed();onUnavailable?.();}}>
    <Canvas className="hero-scene-canvas" style={{position:'absolute',inset:0,zIndex:1}} orthographic camera={{ position: [0, 0, 8], zoom: 85, near: .1, far: 30 }}
      dpr={mobileQuality ? [.65,.8,1][qualityTier] : [.8,1,1.5][qualityTier]} frameloop={renderMode} gl={{ antialias: true, alpha: true }}

      aria-label={t("Three red leather balls")+' — '+t(JUGGLING_TRICKS[selectedTrick])}>

      <ContextLossGuard onUnavailable={onUnavailable}/>
      <AdaptiveQuality enabled={sceneActive&&!reduced&&sceneIndex<2&&ballsReady} tier={qualityTier} onChange={setQualityTier} onUnavailable={onUnavailable}/>
      <Environment resolution={mobileQuality||qualityTier<2?128:256}><Lightformer position={[0,4,3]} scale={[8,4,1]} intensity={3}/><Lightformer position={[-4,1,2]} scale={[2,6,1]} intensity={2}/><Lightformer position={[4,1,-2]} scale={[2,6,1]} intensity={3}/></Environment>
      <ambientLight intensity={.55} />
      <hemisphereLight args={['#ffe6c5', '#38251c', 1.1]} />
      <directionalLight position={[3, 5, 6]} color="#ffe8cc" intensity={2.6} />
      {!mobileQuality&&qualityTier>0&&<directionalLight position={[-4, 1, 3]} color="#d6b395" intensity={.9} />}<directionalLight position={[2, 3, -3]} color="#ffb765" intensity={2} />
      <PackageInspectionRig view={sceneIndex===1?ballView:packageView} centerY={sceneIndex===1?(mobileQuality?.07:0):.14}><Suspense fallback={null}><BallsReady onReady={markReady}/>{[0,1,2].map(index=><LeatherBall mobile={mobileQuality} modelAsset={modelAsset} key={index} entrance={entrance} launch={launch} index={index} rig={rig} requested={requestedTrick} onTrickChange={setTrickIndex} progress={reduced ? visualProgress : transition} packing={packing} reduced={!!reduced} horizontal={reduced ? horizontal : smoothHorizontal} vertical={reduced ? vertical : smoothVertical}/>)}</Suspense>{ballsReady&&sceneIndex>=2&&<Suspense fallback={null}><PackagingScene packing={packing} onReady={markPackageReady}/></Suspense>}</PackageInspectionRig>
      {!mobileQuality&&qualityTier===2&&<SceneShadows/>}
    </Canvas></SceneBoundary>
    {introPhase>=3&&!ballsReady&&!sceneFailed&&<div className="hero-balls-loading"><JugglingLoader label={t("Loading leather ball models")} progress={ballsProgress}/></div>}
    {ballsReady&&sceneIndex===4&&!packageModelReady&&<div className="hero-balls-loading"><JugglingLoader label={language==='fa'?'بارگذاری بسته‌بندی':'Loading packaging'} progress={packageProgress}/></div>}
    <motion.div className="hero-trick-title" aria-hidden={sceneIndex!==0||!trickVisible} initial={false} animate={{opacity:sceneIndex===0&&trickVisible?1:0}} transition={{duration:reduced?0:.25}}>
      <h1 className="hero-trick-backdrop" lang="en" dir="ltr">
        <motion.span key={JUGGLING_TRICKS[selectedTrick]}
          data-long={JUGGLING_TRICKS[selectedTrick].length>14}
          style={{display:'block'}}
          initial={{opacity:reduced?1:.6}}
          animate={{opacity:1}}
          transition={{duration:reduced?0:.12}}
        >{JUGGLING_TRICKS[selectedTrick]}</motion.span>
      </h1>
    </motion.div>
    {sceneIndex===0&&trickVisible&&<div className="hero-trick-controls" onPointerDown={()=>{trickInteractionUntil.current=Date.now()+1400;}} role="group" aria-label={t("Juggling tricks")}>
      <motion.div className="hero-trick-swipe" onPanEnd={(_,info)=>{if(Math.abs(info.offset.x)>45&&Math.abs(info.offset.x)>Math.abs(info.offset.y)*1.3)changeTrick(info.offset.x<0?1:-1);}} />
      <button ref={previousArrow} style={{visibility:trickArrowsHidden?'hidden':'visible'}} disabled={trickArrowsHidden} className="hero-trick-arrow hero-trick-prev" aria-label={t("Previous trick")} onClick={()=>changeTrick(-1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <button ref={nextArrow} style={{visibility:trickArrowsHidden?'hidden':'visible'}} disabled={trickArrowsHidden} className="hero-trick-arrow hero-trick-next" aria-label={t("Next trick")} onClick={()=>changeTrick(1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
    </div>}
    <HeroCaption className="hero-product-copy hero-intro-copy" revealOpacity={.7} duration={1} visible={sceneIndex===0&&introPhase>=2} title={<>{t("Live between letting go and catching.")}<EmojiAccent>🤹</EmojiAccent></>} description={t("The physical skill of throwing and catching multiple objects in the air.")}/>
    {ballsReady&&sceneIndex===1&&<PackageGestures key="ball" view={ballView} subject="ball"/>}
    <ProductDetails visible={sceneIndex===1} reduced={!!reduced} language={language}/>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 2} initial={false} animate={{opacity:sceneIndex === 2 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 38 30 L 68 43 L 84 43" pathLength={1} style={{pathLength:leatherLine}}/><circle cx="38" cy="30" r=".6"/></svg>
      <HeroCaption className="hero-detail-copy" visible={sceneIndex===2} title={<>{t("Naturally tactile.")}<EmojiAccent>🐐</EmojiAccent></>} description={t("Goat leather. A feel of its own.")}/>
    </motion.div>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 3} initial={false} animate={{opacity:sceneIndex === 3 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 43 32 L 68 45 L 84 45" pathLength={1} style={{pathLength:stitchLine}}/><circle cx="43" cy="32" r=".6"/></svg>
      <HeroCaption className="hero-detail-copy" visible={sceneIndex===3} title={<>{t("Strength in every stitch.")}<EmojiAccent>🪡</EmojiAccent></>} description={t("Durable thread. Made for repetition.")}/>
    </motion.div>
    {sceneIndex===4&&packagingReady&&packageModelReady&&<PackageGestures view={packageView}/> }
    <HeroCaption className="hero-product-copy hero-packaging-copy" visible={sceneIndex===4&&packagingReady} title={language==='fa'?<>خرید آنی ، تحویل آنی <img src="/assets/fire-apple.png" alt="🔥" width="64" height="64" style={{display:'inline-block',width:'1em',height:'1em',verticalAlign:'-0.12em'}} /></>:"Ready to order. Ready to ship."} description={language==='fa'?"":"Choose your JUG balls and find your rhythm."}><motion.button className="hero-see-options" onClick={onSeeOptions} initial={false} animate={{opacity:sceneIndex===4&&packagingReady?1:0,y:sceneIndex===4&&packagingReady?0:14}} transition={{duration:reduced?0:.5,delay:reduced?0:.18}} whileHover={reduced?{}:{y:-3}} whileTap={reduced?{}:{scale:.97}}><span className="hero-see-label">{language==='fa'?"مشاهده و انتخاب توپ‌ها":"Explore the collection"}<EmojiAccent>🤹</EmojiAccent></span><span className="hero-see-arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg></span></motion.button></HeroCaption>
    {introPhase>=3&&ballsReady&&sceneIndex!==4&&<button ref={downArrow} className="hero-trick-arrow hero-down-arrow" aria-label={t("SCROLL TO EXPLORE")} onClick={()=>{
      if(!advanceChapter.current())return;
      const arrow=downArrow.current;
      if(!arrow)return;
      arrow.getAnimations().forEach(animation=>animation.cancel());
      arrow.animate([{opacity:1,scale:reduced?'1':'1.12'},{opacity:.72,scale:'1'}],{duration:260,easing:'ease-out'});
    }}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m6 10 6 6 6-6"/></svg></button>}
  </div></div>;
}
