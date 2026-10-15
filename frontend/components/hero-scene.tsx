'use client';
import {assetPath} from './preview-client';
import {useLanguage} from './language';
import {createJugglingController, type JugglingController, JUGGLING_TRICKS} from './juggling-patterns';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useGLTF, Environment, Lightformer } from '@react-three/drei';
import { motion, animate, useMotionValue, useSpring, useReducedMotion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box3, Vector3, Euler, Quaternion, FrontSide, type Group, type Mesh, type MeshPhysicalMaterial } from 'three';

function LeatherBall({ horizontal, vertical, index, reduced, progress, packing, onTrickChange, rig, requested }: { rig:JugglingController; requested:MotionValue<number>; onTrickChange:(index:number)=>void; packing: MotionValue<number>; horizontal: MotionValue<number>; vertical: MotionValue<number>; index: number; reduced: boolean; progress: MotionValue<number> }) {
  const { scene } = useGLTF(assetPath('/assets/jug-brown-ball-web.glb'));
  const { viewport, invalidate } = useThree();
  const ref = useRef<Group>(null);
  const showcaseAngle = useRef(0);
  const lastTrick = useRef(-1);
  const animationTime = useRef(0);
  const showcasePose = useMemo(() => ({ euler: new Euler(), quaternion: new Quaternion() }), []);
  const radius = Math.min(viewport.width * .068, viewport.height * .06);
  const { object, scale, center } = useMemo(() => {
    const object = scene.clone(true);
    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    return { object, scale: 2 / Math.max(size.x, size.y, size.z), center: bounds.getCenter(new Vector3()) };
  }, [scene]);
  useEffect(() => {
    const offRequest=requested.on('change',()=>invalidate());
    const offX = horizontal.on('change', () => invalidate());
    const offY = vertical.on('change', () => invalidate());
    const offPacking = packing.on('change', () => invalidate());
    const offProgress = progress.on('change', () => invalidate());
    return () => { offX(); offY(); offProgress(); offPacking(); offRequest(); };
  }, [horizontal, vertical, progress, packing, requested, invalidate]);
  useFrame(({clock}, delta) => {
    if (!ref.current) return;
    if(!reduced) animationTime.current += Math.min(delta,.04);
    const elapsed=animationTime.current;
    const span=viewport.width*.18;
    const height=Math.min(viewport.height*.30,viewport.width*.62);
    const frame=rig.frame(clock.elapsedTime,delta,requested.get(),reduced);
    const trick={...frame.positions[index],index:frame.index};
    const perspectiveScale=1/(1-trick.z/8);
    const spin=reduced?0:elapsed*4.2+index*1.2;
    ref.current.position.set(trick.x*span,viewport.height*.12+trick.y*height,trick.z);
    if(index===0 && lastTrick.current!==trick.index){lastTrick.current=trick.index;onTrickChange(trick.index);}
    const overall = Math.min(1, Math.max(0, progress.get()));
    const pack = packing.get();
    ref.current.visible = index === 0 || overall < .3 || pack > .48;
    const transition = Math.min(1, overall * 4);
    const leather = Math.min(1, Math.max(0, overall * 4 - 1));
    const stitch = Math.min(1, Math.max(0, overall * 4 - 2));
    const leatherMix = leather * leather * (3 - 2 * leather);
    const stitchMix = stitch * stitch * (3 - 2 * stitch);
    const mix = transition * transition * (3 - 2 * transition);
    if (index === 0) {
      ref.current.position.x *= 1 - mix;
      ref.current.position.y += (viewport.height * .17 - ref.current.position.y) * mix;
      ref.current.position.z *= 1 - mix;
      ref.current.position.x -= viewport.width * .12 * leatherMix;
      ref.current.position.y += viewport.height * .06 * leatherMix;
    } else {
      ref.current.position.x += (index === 1 ? -1 : 1) * viewport.width * mix;
      ref.current.position.y += viewport.height * .35 * mix;
    }
    ref.current.scale.setScalar(radius * scale * (index === 0 ? (perspectiveScale + (1 - perspectiveScale) * mix) * (1 + 2.6 * mix + 3.8 * leatherMix + 5 * stitchMix) : perspectiveScale * (1 - .45 * mix)));
    ref.current.rotation.set(
      vertical.get() + spin * (index === 1 ? -.55 : .55),
      horizontal.get() + index * 1.2 + spin * (index === 2 ? -.8 : .8),
      -.35 + spin * .3
    );
    if (index === 0) {
      // Product showcase: one steady revolution in about 18 seconds.
      if (!reduced) showcaseAngle.current += Math.min(delta, .05) * .35 * mix * (1 - leatherMix);
      showcasePose.euler.set(.2 + vertical.get() - .35, (showcaseAngle.current + horizontal.get()) * (1 - leatherMix) + (-.6 + horizontal.get() + .6) * leatherMix + .65 * stitchMix, -.12);
      showcasePose.quaternion.setFromEuler(showcasePose.euler);
      ref.current.quaternion.slerp(showcasePose.quaternion, mix);
    }

    if (pack > 0) {
      const clamp = (v:number) => Math.min(1,Math.max(0,v));
      const smooth = (v:number) => { const t=clamp(v);return t*t*(3-2*t); };
      const fit=Math.min(viewport.height*.45/.252,viewport.width*.55/.088);
      const jarRotation=new Euler(.08,-.6,0);
      // Slight leather compression keeps the stack in contact rather than floating apart.
      const impact=(start:number)=>{const t=clamp((pack-start)/.045);return 4*t*(1-t);};
      const compression=(index<1?impact(.65):0)+(index<2?impact(.83):0);
      const rest=new Vector3(0,.041+index*.0718-.126-.0012*compression,0).applyEuler(jarRotation).multiplyScalar(fit);
      rest.y+=viewport.height*.14;
      const ballRadius=.0365*fit;
      if(index===0) {
        const zoom=smooth(pack/.24);
        const insert=clamp((pack-.34)/.17);
        const approach=new Vector3(0,viewport.height*.43,0);
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
    <ContactShadows position={[0, -viewport.height * .4, 0]} opacity={.2} scale={viewport.width * 1.4} blur={3} far={viewport.height} resolution={256} />
  </>;
}


function PackagingScene({packing}:{packing:MotionValue<number>}) {
  const {scene}=useGLTF(assetPath('/assets/jug-three-ball-packaging.glb'));
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
    const fit=Math.min(viewport.height*.45/.252,viewport.width*.55/.088);
    ref.current.visible=t>.16;
    ref.current.scale.setScalar(fit);
    ref.current.position.set(0,viewport.height*.14-viewport.height*1.1*(1-ease),-.6*(1-ease));
    ref.current.rotation.set(.08,-.6,0);
    if(cap){const close=clamp((t-.86)/.11);cap.position.y=capY+.12*(1-close*close*(3-2*close));}
  });
  return <group ref={ref} visible={false}><primitive object={object} position={[0,-.126,0]}/></group>;
}

function SceneFailure(){const {t}=useLanguage();return <div className="hero-model-error" role="status">{t("3D preview unavailable. Please reload to try again.")}</div>;}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <SceneFailure/>
      : this.props.children;
  }
}

export default function HeroScene({onSeeOptions}:{onSeeOptions:()=>void}) {
  const {t}=useLanguage();
  const [trickIndex,setTrickIndex]=useState(0);
  const [selectedTrick,setSelectedTrick]=useState(0);
  const requestedTrick=useMotionValue(0);
  const trickInteractionUntil=useRef(0);
  const rig=useMemo(()=>createJugglingController(),[]);
  const changeTrick=(direction:number)=>{
    trickInteractionUntil.current=Date.now()+1400;
    const next=(requestedTrick.get()+direction+JUGGLING_TRICKS.length)%JUGGLING_TRICKS.length;
    requestedTrick.set(next);setSelectedTrick(next);
  };
  const reduced = useReducedMotion();
  const story = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: story, offset: ['start start', 'end end'] });
  const packing = useMotionValue(0);
  const packingAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const packingTarget=useRef<0|1>(0);
  const [unpacking,setUnpacking]=useState(false);
  const [packingVisible,setPackingVisible]=useState(false);
  const [packagingReady,setPackagingReady]=useState(false);
  useMotionValueEvent(packing,'change',value=>{
    setPackagingReady(value>=.97);
    setPackingVisible(value>0);
  });
  useEffect(()=>()=>packingAnimation.current?.stop(),[]);
  useMotionValueEvent(scrollYProgress,'change',value=>{
    const target=value>=.8?1:value<.78?0:packingTarget.current;
    if(target===packingTarget.current)return;
    packingAnimation.current?.stop();
    packingTarget.current=target;
    setUnpacking(target===0);
    const remaining=Math.abs(target-packing.get());
    packingAnimation.current=animate(packing,target,{duration:reduced?0:(target===1?4.2:3.6)*remaining,ease:'linear'});
  });
  const [scrollScene,setScrollScene]=useState(0);
  useMotionValueEvent(scrollYProgress,'change',value=>setScrollScene(Math.min(4,Math.floor(value*4+.5))));
  const sceneIndex=packingVisible?4:scrollScene;
  // Keep the close-up pose stable until the complete reverse packing timeline finishes.
  const visualProgress=useTransform([scrollYProgress,packing],([scroll,pack])=>Number(pack)>0?Math.max(Number(scroll),.75):Number(scroll));
  const transition=useSpring(visualProgress,{stiffness:90,damping:25});
  const firstOpacity = useTransform(scrollYProgress, [0, .1, .19], [1, 0, 0]);
  const secondOpacity = useTransform(scrollYProgress, [.1, .22, .3, .4], [0, 1, 1, 0]);
  const leatherLine = useTransform(scrollYProgress, [.39, .495], [0, 1]);
  const stitchLine = useTransform(scrollYProgress, [.64, .745], [0, 1]);
  const firstY = useTransform(scrollYProgress, [0, 1], [0, -65]);
  const secondY = useTransform(scrollYProgress, [0, 1], [65, 0]);
  useEffect(() => {
    let lockedUntil = 0;
    let navigationUntil = 0;
    let touchStart = 0;
    let touchStartX = 0;
    let previousScroll = window.scrollY;
    let scrollTimer:ReturnType<typeof setTimeout> | undefined;
    const snap = (direction: number) => {
      const element = story.current;
      const reversing=direction<0&&packingTarget.current===1&&packing.get()>0;
      if (!element || (Date.now()<lockedUntil&&!reversing) || Date.now()<navigationUntil) return false;
      const start = element.getBoundingClientRect().top + window.scrollY;
      const end = start + element.offsetHeight - window.innerHeight;
      const current = window.scrollY;
      if (current < start - window.innerHeight * .3 || current > end + 4) return false;
      if (direction < 0 && current <= start + 4) return false;
      const step = (end - start) / 4;
      const relative = Math.max(0, (current - start) / step);
      const leavingJar=direction<0&&packing.get()>0;
      const next=leavingJar?3:direction>0?Math.floor(relative+.025)+1:Math.ceil(relative-.025)-1;
      const destination = start + Math.max(0, Math.min(4, next)) * step;
      if (Math.abs(destination - current) < 4) return false;
      lockedUntil=Date.now()+(!reduced&&leavingJar?4100:next===4&&direction>0&&!reduced?4800:1100);
      window.scrollTo({ top: destination, behavior: reduced ? 'instant' : 'smooth' });
      return true;
    };
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 2 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if(Date.now()<lockedUntil&&!(event.deltaY<0&&packingTarget.current===1&&packing.get()>0)){event.preventDefault();return;}
      if (snap(event.deltaY)) event.preventDefault();
    };
    const startTouch = (event: TouchEvent) => { touchStart = event.touches[0]?.clientY ?? 0; touchStartX=event.touches[0]?.clientX??0; };
    const endTouch = (event: TouchEvent) => {
      const distance = touchStart - (event.changedTouches[0]?.clientY ?? touchStart);
      const horizontalDistance=touchStartX-(event.changedTouches[0]?.clientX??touchStartX);
      if (Math.abs(distance)>15 && Math.abs(distance)>Math.abs(horizontalDistance)*1.2) snap(distance);
    };
    const scroll = () => {
      const current = window.scrollY;
      const direction = current - previousScroll;
      previousScroll = current;
      clearTimeout(scrollTimer);
      if (Math.abs(direction) > .5 && Date.now()>trickInteractionUntil.current) scrollTimer=setTimeout(()=>{if(Date.now()>trickInteractionUntil.current)snap(direction);},120);
    };
    const navigation = (event:KeyboardEvent) => { if(['Home','End','PageUp','PageDown'].includes(event.key)) navigationUntil=Date.now()+1800; };
    window.addEventListener('keydown',navigation);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('wheel', wheel, { passive: false });
    const guardTouch=(event:TouchEvent)=>{if(Date.now()<lockedUntil&&packingTarget.current===0&&packing.get()>0)event.preventDefault();};
    window.addEventListener('touchmove',guardTouch,{passive:false});
    window.addEventListener('touchstart', startTouch, { passive: true });
    window.addEventListener('touchend', endTouch, { passive: true });
    return () => { clearTimeout(scrollTimer); window.removeEventListener('keydown',navigation); window.removeEventListener('scroll', scroll); window.removeEventListener('wheel', wheel); window.removeEventListener('touchmove',guardTouch); window.removeEventListener('touchstart', startTouch); window.removeEventListener('touchend', endTouch); };
  }, [reduced]);
  const horizontal = useMotionValue(-.6);
  const vertical = useMotionValue(.35);
  const smoothHorizontal = useSpring(horizontal, { stiffness: 180, damping: 24 });
  const smoothVertical = useSpring(vertical, { stiffness: 180, damping: 24 });
  return <div className="hero-scroll-story" ref={story}><div className="hero-sticky-stage"><SceneBoundary>
    <Canvas orthographic camera={{ position: [0, 0, 8], zoom: 85, near: .1, far: 30 }}
      dpr={[1, 2]} frameloop={reduced ? "demand" : "always"} gl={{ antialias: true, alpha: true }}
      aria-label={t("Three brown leather balls")+' — '+t(JUGGLING_TRICKS[trickIndex])}>
      <Environment resolution={256}><Lightformer position={[0,4,3]} scale={[8,4,1]} intensity={3}/><Lightformer position={[-4,1,2]} scale={[2,6,1]} intensity={2}/><Lightformer position={[4,1,-2]} scale={[2,6,1]} intensity={3}/></Environment>
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#fff6e8', '#b8aaa0', 2]} />
      <directionalLight position={[3, 5, 6]} intensity={3} />
      <directionalLight position={[-4, 1, 3]} intensity={1.5} />
      <Suspense fallback={null}>{[0, 1, 2].map(index => <LeatherBall key={index} index={index} rig={rig} requested={requestedTrick} onTrickChange={setTrickIndex} progress={reduced ? visualProgress : transition} packing={packing} reduced={!!reduced} horizontal={reduced ? horizontal : smoothHorizontal} vertical={reduced ? vertical : smoothVertical} />)}<PackagingScene packing={packing}/></Suspense>
    </Canvas>
    {sceneIndex===0&&<div className="hero-trick-controls" onPointerDown={()=>{trickInteractionUntil.current=Date.now()+1400;}} role="group" aria-label={t("Juggling tricks")}>
      <motion.div className="hero-trick-swipe" onPanEnd={(_,info)=>{if(Math.abs(info.offset.x)>45&&Math.abs(info.offset.x)>Math.abs(info.offset.y)*1.3)changeTrick(info.offset.x<0?1:-1);}} />
      <button className="hero-trick-arrow hero-trick-prev" aria-label={t("Previous trick")} onClick={()=>changeTrick(-1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></button>
      <button className="hero-trick-arrow hero-trick-next" aria-label={t("Next trick")} onClick={()=>changeTrick(1)}><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></button>
      <div className="hero-trick-status" aria-live="polite">{selectedTrick!==trickIndex?t("Preparing next trick"):t("Swipe to change trick")}</div>
    </div>}
    <motion.div className="hero-product-copy" aria-hidden={sceneIndex !== 0} style={{opacity:firstOpacity,y:firstY}}><span className="hero-trick-label">{String(selectedTrick+1).padStart(2,'0')} / {JUGGLING_TRICKS.length} · {t(JUGGLING_TRICKS[selectedTrick])}</span><h1>{t("juggling, balls")}</h1><p>{t("handmade  goat leather")}</p><p>{t("Features highly durable Thread")}</p></motion.div>
    <motion.div className="hero-product-copy hero-second-copy" aria-hidden={sceneIndex !== 1} style={{opacity:secondOpacity,y:secondY}}><span className="hero-chapter">{t("02 / CRAFT IN YOUR HANDS")}</span><h2>{t("Every stitch.")}<br/>{t("Every throw.")}</h2><p>{t("handmade  goat leather")}</p><p>{t("Features highly durable Thread")}</p></motion.div>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 2} initial={false} animate={{opacity:sceneIndex === 2 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 38 30 L 68 43 L 84 43" pathLength={1} style={{pathLength:leatherLine}}/><circle cx="38" cy="30" r=".6"/></svg>
      <div className="hero-detail-copy"><span className="hero-chapter">{t("03 / THE LEATHER")}</span><h2>{t("Quality you")}<br/>{t("can feel.")}</h2><p>{t("Handmade goat leather.")}</p><p>{t("A close look at the natural grain")}<br/>{t("and the texture in every ball.")}</p></div>
    </motion.div>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 3} initial={false} animate={{opacity:sceneIndex === 3 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 43 32 L 68 45 L 84 45" pathLength={1} style={{pathLength:stitchLine}}/><circle cx="43" cy="32" r=".6"/></svg>
      <div className="hero-detail-copy"><span className="hero-chapter">{t("04 / THE STITCHING")}</span><h2>{t("Small stitches.")}<br/>{t("Strong connection.")}</h2><p>{t("Highly durable thread.")}</p><p>{t("Follow the seam, stitch by stitch.")}<br/>{t("The detail that holds it all together.")}</p></div>
    </motion.div>
    <motion.div className="hero-product-copy hero-packaging-copy" aria-hidden={sceneIndex !== 4 || !packagingReady} initial={false} animate={{opacity:sceneIndex === 4 && packagingReady ? 1 : 0}}><span className="hero-chapter">{t("05 / THE PACKAGING")}</span><h2>{t("Three balls.")}<br/>{t("One home.")}</h2><p>{t("Your JUG set, together in its branded glass jar.")}</p><p>{t("From the first look to the next practice.")}</p><button className="button orange hero-see-options" onClick={onSeeOptions}>{t("See options")}<span aria-hidden="true">↗</span></button></motion.div>
    <div className="hero-scroll-hint" aria-hidden="true" style={{display:sceneIndex===4&&packagingReady?'none':undefined}}>{sceneIndex === 4 && !packagingReady ? (unpacking?t("UNPACKING YOUR SET"):t("PACKING YOUR SET")) : t("SCROLL TO EXPLORE")} <span>{sceneIndex === 4 && !packagingReady ? '·' : '↓'}</span></div>
  </SceneBoundary></div></div>;
}
