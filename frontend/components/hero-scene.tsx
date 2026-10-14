'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { motion, useMotionValue, useSpring, useReducedMotion, type MotionValue } from 'framer-motion';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Box3, Vector3, type Group } from 'three';

function LeatherBall({ horizontal, vertical, index, reduced }: { horizontal: MotionValue<number>; vertical: MotionValue<number>; index: number; reduced: boolean }) {
  const { scene } = useGLTF('/assets/leather-ball-brown.glb');
  const { viewport, invalidate } = useThree();
  const ref = useRef<Group>(null);
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
    return () => { offX(); offY(); };
  }, [horizontal, vertical, invalidate]);
  useFrame(({ clock }) => {
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
    ref.current.scale.setScalar(radius * scale * perspectiveScale);
    ref.current.rotation.set(
      vertical.get() + spin * (index === 1 ? -.55 : .55),
      horizontal.get() + index * 1.2 + spin * (index === 2 ? -.8 : .8),
      -.35 + spin * .3
    );
  });
  return <>
    <group ref={ref} position={[0, viewport.height * .25, 0]} scale={radius * scale} rotation={[.35, -.6, -.35]}>
      <primitive object={object} position={[-center.x, -center.y, -center.z]} />
    </group>
    <ContactShadows position={[0, -viewport.height * .4, 0]} opacity={.2} scale={viewport.width * 1.4} blur={3} far={viewport.height} resolution={256} />
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="hero-model-error" role="status">3D preview unavailable. Please reload to try again.</div>
      : this.props.children;
  }
}

export default function HeroScene() {
  const reduced = useReducedMotion();
  const horizontal = useMotionValue(-.6);
  const vertical = useMotionValue(.35);
  const smoothHorizontal = useSpring(horizontal, { stiffness: 180, damping: 24 });
  const smoothVertical = useSpring(vertical, { stiffness: 180, damping: 24 });
  const reset = () => { horizontal.set(-.6); vertical.set(.35); };
  return <SceneBoundary>
    <Canvas orthographic camera={{ position: [0, 0, 8], zoom: 85, near: .1, far: 30 }}
      dpr={[1, 1.5]} frameloop={reduced ? "demand" : "always"} gl={{ antialias: true, alpha: true }}
      aria-label="Three brown leather balls juggling in a cascade">
      <ambientLight intensity={1.5} />
      <hemisphereLight args={['#fff6e8', '#b8aaa0', 2]} />
      <directionalLight position={[3, 5, 6]} intensity={3} />
      <directionalLight position={[-4, 1, 3]} intensity={1.5} />
      <Suspense fallback={null}>{[0, 1, 2].map(index => <LeatherBall key={index} index={index} reduced={!!reduced} horizontal={reduced ? horizontal : smoothHorizontal} vertical={reduced ? vertical : smoothVertical} />)}</Suspense>
    </Canvas>
    <div className="hero-product-copy"><h1>juggling, balls</h1><p>handmade  goat leather</p><p>Features highly durable Thread</p></div>
    <motion.div className="hero-ball-control" role="group" tabIndex={0}
      aria-label="Rotate leather ball. Drag in any direction or use arrow keys. Double click or press Home to reset."
      onPan={(_, info) => {
        horizontal.set(horizontal.get() + info.delta.x * .012);
        vertical.set(vertical.get() + info.delta.y * .012);
      }}
      onDoubleClick={reset}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Home') reset();
        else if (event.key === 'ArrowLeft') horizontal.set(horizontal.get() - .2);
        else if (event.key === 'ArrowRight') horizontal.set(horizontal.get() + .2);
        else vertical.set(vertical.get() + (event.key === 'ArrowUp' ? -.2 : .2));
      }} />
  </SceneBoundary>;
}
