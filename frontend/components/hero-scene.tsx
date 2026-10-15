'use client';
import {assetPath} from './preview-client';
import {useLanguage} from './language';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useGLTF, Environment, Lightformer } from '@react-three/drei';
import { motion, animate, useMotionValue, useSpring, useReducedMotion, useScroll, useTransform, useMotionValueEvent, type MotionValue } from 'framer-motion';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box3, Vector3, Euler, Quaternion, FrontSide, type Group, type Mesh, type MeshPhysicalMaterial } from 'three';

function LeatherBall({ horizontal, vertical, index, reduced, progress, packing }: { packing: MotionValue<number>; horizontal: MotionValue<number>; vertical: MotionValue<number>; index: number; reduced: boolean; progress: MotionValue<number> }) {
  const { scene } = useGLTF(assetPath('/assets/jug-brown-ball-web.glb'));
  const { viewport, invalidate } = useThree();
  const ref = useRef<Group>(null);
  const showcaseAngle = useRef(0);
  const showcasePose = useMemo(() => ({ euler: new Euler(), quaternion: new Quaternion() }), []);
  const radius = Math.min(viewport.width * .068, viewport.height * .06);
  const { object, scale, center } = useMemo(() => {
    const object = scene.clone(true);
    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    return { object, scale: 2 / Math.max(size.x, size.y, size.z), center: bounds.getCenter(new Vector3()) };
  }, [scene]);
  useEffect(() => {
    const offX = horizontal.on('change', () => invalidate());
    const offY = vertical.on('change', () => invalidate());
    const offPacking = packing.on('change', () => invalidate());
    const offProgress = progress.on('change', () => invalidate());
    return () => { offX(); offY(); offProgress(); offPacking(); };
  }, [horizontal, vertical, progress, packing, invalidate]);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    // Each ball alternates hands, with three throws evenly staggered in time.
    const beat = (reduced ? .6 : clock.elapsedTime / .38) + index * 2;
    const leg = Math.floor(beat / 3);
    const phase = (beat % 3) / 3;
    const direction = leg % 2 === 0 ? 1 : -1;
    const flightDuration = .86;
    const flight = Math.min(phase / flightDuration, 1);
    const span = viewport.width * .18;
    const inner = span * .68;
    const height = Math.min(viewport.height * .27, viewport.width * .52);
    const catchPhase = Math.max(0, (phase - flightDuration) / (1 - flightDuration));
    // Ballistic flight: initial upward velocity is cancelled by constant gravity.
    const flightSeconds = 3 * .38 * flightDuration;
    const gravity = 8 * height / (flightSeconds * flightSeconds);
    const time = flight * flightSeconds;
    const launchVelocity = gravity * flightSeconds / 2;
    const lift = launchVelocity * time - .5 * gravity * time * time;
    const scoop = catchPhase * catchPhase * (3 - 2 * catchPhase);
    const x = phase < flightDuration
      ? direction * (-inner + (span + inner) * flight)
      : direction * (span + (inner - span) * scoop);
    // A shallow front/back offset separates the crossing throws without teleporting.
    const depth = direction * .5 * Math.sin(Math.PI * flight);
    const perspectiveScale = 1 / (1 - depth / 8);
    const spin = reduced ? 0 : leg * Math.PI * 2 + flight * Math.PI * 1.85 + catchPhase * Math.PI * .15;
    ref.current.position.set(
      x,
      viewport.height * .12 + lift - radius * .65 * Math.sin(catchPhase * Math.PI),
      depth
    );
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
      const rest=new Vector3(0,.041+index*.074-.126,0).applyEuler(jarRotation).multiplyScalar(fit);
      rest.y+=viewport.height*.14;
      const ballRadius=.0365*fit;
      if(index===0) {
        const zoom=smooth(pack/.24);
        const insert=clamp((pack-.34)/.17);
        const approach=new Vector3(0,viewport.height*.43,0);
        ref.current.position.lerp(approach,zoom);
        ref.current.scale.setScalar(ref.current.scale.x+(ballRadius*scale-ref.current.scale.x)*zoom);
        ref.current.position.lerp(rest,insert*insert);
      } else {
        const start=index===1?.5:.68;
        const fall=clamp((pack-start)/.15);
        ref.current.visible=pack>=start;
        const top=viewport.height*.65;
        // Constant acceleration, followed by a very small damped settling bounce.
        const bounce=pack>start+.15 ? Math.sin(clamp((pack-start-.15)/.07)*Math.PI)*ballRadius*.07 : 0;
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
    ref.current.position.set(0,viewport.height*.14-viewport.height*.65*(1-ease),-.6*(1-ease));
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

export default function HeroScene() {
  const {t}=useLanguage();
  const reduced = useReducedMotion();
  const story = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: story, offset: ['start start', 'end end'] });
  const packing = useMotionValue(0);
  const packingAnimation = useRef<ReturnType<typeof animate> | null>(null);
  const [packagingReady,setPackagingReady]=useState(false);
  useMotionValueEvent(packing, 'change', value=>setPackagingReady(value>=.97));
  useEffect(()=>()=>packingAnimation.current?.stop(),[]);
  useMotionValueEvent(scrollYProgress, 'change', value=>{
    if(value>=.8 && !packingAnimation.current){
      packingAnimation.current=animate(packing,1,{duration:reduced?0:7,ease:"linear"});
    }else if(value<.78 && packingAnimation.current){
      packingAnimation.current.stop();packingAnimation.current=null;packing.set(0);
    }
  });
  const [sceneIndex, setSceneIndex] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', value => setSceneIndex(Math.min(4, Math.floor(value * 4 + .5))));
  const transition = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });
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
    let previousScroll = window.scrollY;
    let scrollTimer:ReturnType<typeof setTimeout> | undefined;
    const snap = (direction: number) => {
      const element = story.current;
      if (!element || Date.now() < lockedUntil || Date.now() < navigationUntil) return false;
      const start = element.getBoundingClientRect().top + window.scrollY;
      const end = start + element.offsetHeight - window.innerHeight;
      const current = window.scrollY;
      if (current < start - window.innerHeight * .3 || current > end + 4) return false;
      if (direction < 0 && current <= start + 4) return false;
      const step = (end - start) / 4;
      const relative = Math.max(0, (current - start) / step);
      const next = direction > 0 ? Math.floor(relative + .025) + 1 : Math.ceil(relative - .025) - 1;
      const destination = start + Math.max(0, Math.min(4, next)) * step;
      if (Math.abs(destination - current) < 4) return false;
      lockedUntil = Date.now() + (next === 4 && direction > 0 && !reduced ? 7600 : 1100);
      window.scrollTo({ top: destination, behavior: reduced ? 'instant' : 'smooth' });
      return true;
    };
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 2 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (Date.now() < lockedUntil) { event.preventDefault(); return; }
      if (snap(event.deltaY)) event.preventDefault();
    };
    const startTouch = (event: TouchEvent) => { touchStart = event.touches[0]?.clientY ?? 0; };
    const endTouch = (event: TouchEvent) => {
      const distance = touchStart - (event.changedTouches[0]?.clientY ?? touchStart);
      if (Math.abs(distance) > 15) snap(distance);
    };
    const scroll = () => {
      const current = window.scrollY;
      const direction = current - previousScroll;
      previousScroll = current;
      clearTimeout(scrollTimer);
      if (Math.abs(direction) > .5) scrollTimer=setTimeout(()=>snap(direction),120);
    };
    const navigation = (event:KeyboardEvent) => { if(['Home','End','PageUp','PageDown'].includes(event.key)) navigationUntil=Date.now()+1800; };
    window.addEventListener('keydown',navigation);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('touchstart', startTouch, { passive: true });
    window.addEventListener('touchend', endTouch, { passive: true });
    return () => { clearTimeout(scrollTimer); window.removeEventListener('keydown',navigation); window.removeEventListener('scroll', scroll); window.removeEventListener('wheel', wheel); window.removeEventListener('touchstart', startTouch); window.removeEventListener('touchend', endTouch); };
  }, [reduced]);
  const horizontal = useMotionValue(-.6);
  const vertical = useMotionValue(.35);
  const smoothHorizontal = useSpring(horizontal, { stiffness: 180, damping: 24 });
  const smoothVertical = useSpring(vertical, { stiffness: 180, damping: 24 });
  return <div className="hero-scroll-story" ref={story}><div className="hero-sticky-stage"><SceneBoundary>
    <Canvas orthographic camera={{ position: [0, 0, 8], zoom: 85, near: .1, far: 30 }}
      dpr={[1, 2]} frameloop={reduced ? "demand" : "always"} gl={{ antialias: true, alpha: true }}
      aria-label={t("Three brown leather balls juggling in a cascade")}>
      <Environment resolution={256}><Lightformer position={[0,4,3]} scale={[8,4,1]} intensity={3}/><Lightformer position={[-4,1,2]} scale={[2,6,1]} intensity={2}/><Lightformer position={[4,1,-2]} scale={[2,6,1]} intensity={3}/></Environment>
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#fff6e8', '#b8aaa0', 2]} />
      <directionalLight position={[3, 5, 6]} intensity={3} />
      <directionalLight position={[-4, 1, 3]} intensity={1.5} />
      <Suspense fallback={null}>{[0, 1, 2].map(index => <LeatherBall key={index} index={index} progress={reduced ? scrollYProgress : transition} packing={packing} reduced={!!reduced} horizontal={reduced ? horizontal : smoothHorizontal} vertical={reduced ? vertical : smoothVertical} />)}<PackagingScene packing={packing}/></Suspense>
    </Canvas>
    <motion.div className="hero-product-copy" aria-hidden={sceneIndex !== 0} style={{opacity:firstOpacity,y:firstY}}><h1>{t("juggling, balls")}</h1><p>{t("handmade  goat leather")}</p><p>{t("Features highly durable Thread")}</p></motion.div>
    <motion.div className="hero-product-copy hero-second-copy" aria-hidden={sceneIndex !== 1} style={{opacity:secondOpacity,y:secondY}}><span className="hero-chapter">{t("02 / CRAFT IN YOUR HANDS")}</span><h2>{t("Every stitch.")}<br/>{t("Every throw.")}</h2><p>{t("handmade  goat leather")}</p><p>{t("Features highly durable Thread")}</p></motion.div>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 2} initial={false} animate={{opacity:sceneIndex === 2 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 38 30 L 68 43 L 84 43" pathLength={1} style={{pathLength:leatherLine}}/><circle cx="38" cy="30" r=".6"/></svg>
      <div className="hero-detail-copy"><span className="hero-chapter">{t("03 / THE LEATHER")}</span><h2>{t("Quality you")}<br/>{t("can feel.")}</h2><p>{t("Handmade goat leather.")}</p><p>{t("A close look at the natural grain")}<br/>{t("and the texture in every ball.")}</p></div>
    </motion.div>
    <motion.div className="hero-material-callout" aria-hidden={sceneIndex !== 3} initial={false} animate={{opacity:sceneIndex === 3 ? 1 : 0}} transition={{duration:.45}}>
      <svg className="hero-detail-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><motion.path d="M 43 32 L 68 45 L 84 45" pathLength={1} style={{pathLength:stitchLine}}/><circle cx="43" cy="32" r=".6"/></svg>
      <div className="hero-detail-copy"><span className="hero-chapter">{t("04 / THE STITCHING")}</span><h2>{t("Small stitches.")}<br/>{t("Strong connection.")}</h2><p>{t("Highly durable thread.")}</p><p>{t("Follow the seam, stitch by stitch.")}<br/>{t("The detail that holds it all together.")}</p></div>
    </motion.div>
    <motion.div className="hero-product-copy hero-packaging-copy" aria-hidden={sceneIndex !== 4 || !packagingReady} initial={false} animate={{opacity:sceneIndex === 4 && packagingReady ? 1 : 0}}><span className="hero-chapter">{t("05 / THE PACKAGING")}</span><h2>{t("Three balls.")}<br/>{t("One home.")}</h2><p>{t("Your JUG set, together in its branded glass jar.")}</p><p>{t("From the first look to the next practice.")}</p></motion.div>
    <div className="hero-scroll-hint" aria-hidden="true">{sceneIndex === 4 && !packagingReady ? t("PACKING YOUR SET") : t("SCROLL TO EXPLORE")} <span>{sceneIndex === 4 && !packagingReady ? '·' : '↓'}</span></div>
  </SceneBoundary></div></div>;
}
