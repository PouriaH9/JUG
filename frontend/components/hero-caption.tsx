'use client';

import {motion, useReducedMotion} from 'framer-motion';
import type {ReactNode} from 'react';

export default function HeroCaption({title,description,visible,className,children,revealOpacity=1,duration=.45}:{title:ReactNode;description:string;visible:boolean;className:string;children?:ReactNode;revealOpacity?:number;duration?:number}) {
  const reduced=useReducedMotion();
  const state=visible?'visible':'hidden';
  const variants={hidden:{opacity:0,y:reduced?0:12},visible:{opacity:revealOpacity,y:0}};
  return <div className={className} aria-hidden={!visible} inert={!visible}>
    <motion.div className="caption-rule" aria-hidden="true" initial={false} animate={{scaleX:visible?1:.4,opacity:visible?1:0}} transition={{duration:reduced?0:.55}}/>
    <motion.h2 initial={false} animate={state} variants={variants} transition={{duration:reduced?0:duration,ease:[.22,1,.36,1]}}>{title}</motion.h2>
    <motion.p initial={false} animate={state} variants={variants} transition={{duration:reduced?0:duration,delay:reduced?0:.07,ease:[.22,1,.36,1]}}>{description}</motion.p>
    {children}
  </div>;
}
