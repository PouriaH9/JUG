'use client';

import {useEffect, useRef} from 'react';

/** Local canvas keeps atmospheric motion independent of React and the 3D scene. */
export default function StageAir({quiet=false}:{quiet?:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const element=canvas.current;
    const context=element?.getContext('2d');
    if(!element||!context)return;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile=window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
    let light=document.documentElement.dataset.theme==='light';
    let width=1,height=1,frame=0,last=0,time=0,visible=true;
    let scroll=window.scrollY, easedScroll=scroll, previousScroll=scroll;
    let seed=731;
    const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
    const particles=Array.from({length:mobile?(quiet?24:64):quiet?110:280},()=>({x:random(),y:random(),depth:.3+random()*.7,r:.4+random()*1.3,phase:random()*Math.PI*2,speed:.25+random()*.75}));
    const foreground=Array.from({length:mobile?3:quiet?4:13},()=>({x:random(),y:random(),r:2+random()*4,phase:random()*Math.PI*2,speed:.4+random()*.6}));
    // A feathered turbulence texture avoids the overlapping circles of simple fog.
    const smoke=document.createElement('canvas');smoke.width=256;smoke.height=128;
    const ink=smoke.getContext('2d');
    if(ink){
      const field=Array.from({length:64*32},random);
      const noise=(x:number,y:number)=>{
        const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
        const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
        const at=(a:number,b:number)=>field[((b%32+32)%32)*64+(a%64+64)%64];
        return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
      };
      const pixels=ink.createImageData(256,128);
      for(let y=0;y<128;y++)for(let x=0;x<256;x++){
        const nx=x/256,ny=y/128;
        const turbulence=noise(nx*6,ny*5)*.6+noise(nx*15,ny*13)*.28+noise(nx*31,ny*27)*.12;
        const ribbon=Math.exp(-Math.pow((ny-.5-Math.sin(nx*8)*.12)/.23,2));
        const feather=Math.pow(Math.sin(nx*Math.PI)*Math.sin(ny*Math.PI),1.3);
        const offset=(y*256+x)*4;
        pixels.data[offset]=196;pixels.data[offset+1]=166;pixels.data[offset+2]=126;
        pixels.data[offset+3]=Math.round(Math.max(0,turbulence-.26)*ribbon*feather*76);
      }
      ink.putImageData(pixels,0,0);
    }
    const draw=(now:number)=>{
      frame=0;
      if(!visible||document.hidden)return;
      if(now-last<32&&!media.matches){frame=requestAnimationFrame(draw);return;}
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(!media.matches)time+=dt;
      easedScroll+=(scroll-easedScroll)*.065;
      const currentScroll=media.matches?0:easedScroll;
      const gust=Math.max(-1,Math.min(1,(easedScroll-previousScroll)/40));previousScroll=easedScroll;
      context.clearRect(0,0,width,height);
      // Sunlit dust needs warm shadow tones; screen blending washes out on white.
      context.globalCompositeOperation=light?'multiply':'screen';
      // Keep the strongest haze around the performance; leave captions in darkness.
      for(let i=0;i<(mobile?3:7);i++){
        const phase=i*1.7;
        const x=width*(.5+Math.sin(time*.065+phase)*.25)+Math.sin(currentScroll*.001+i)*width*.07;
        const y=height*(.22+i*.065)+Math.cos(time*.09+phase)*height*.045-currentScroll*(.025+i*.006);
        const w=width*(.95+i*.08),h=height*.34;
        context.save();
        context.translate(x,((y%height)+height)%height);
        context.rotate(Math.sin(time*.045+phase)*.16);
        context.globalAlpha=(quiet?.3:light?.7:.52)*(1-i*.065);
        context.drawImage(smoke,-w/2,-h/2,w,h);
        context.restore();
      }
      // Long, curved wisps catch the light unevenly, like haze above a stage.
      for(let i=0;i<(mobile?1:3);i++){
        context.save();
        const bend=Math.sin(time*.075+i*2+currentScroll*.0005);
        context.translate(width*(.35+i*.17)+bend*width*.08,height*(.34+i*.085)-Math.sin(currentScroll*.0007+i)*height*.035);
        context.rotate(-.18+bend*.12);
        context.scale(width*.65,height*.08);
        const veil=context.createRadialGradient(0,0,0,0,0,1);
        veil.addColorStop(0,'rgba(199,161,108,.075)');
        veil.addColorStop(.35,'rgba(199,161,108,.035)');
        veil.addColorStop(1,'rgba(199,161,108,0)');
        context.globalAlpha=quiet?.3:.65;context.fillStyle=veil;
        context.fillRect(-1,-1,2,2);context.restore();
      }
      for(const p of particles){
        const x=((p.x*width+Math.sin(time*.13+p.phase+p.y*5)*34+time*p.speed*3+currentScroll*p.depth*.045)%width+width)%width;
        const y=((p.y*height-time*p.speed*5-currentScroll*p.depth*.17)%height+height)%height;
        const beam=Math.exp(-Math.pow((x/width-.5)/.32,2));
        const vertical=Math.max(0,1-Math.pow((y/height-.36)/.48,2));
        const shimmer=.65+.35*Math.sin(time*.65+p.phase);
        context.globalAlpha=(quiet?.3:light?.9:.78)*beam*vertical*shimmer*p.depth;
        context.fillStyle=light?(p.depth>.75?'#987044':'#b39a77'):(p.depth>.75?'#f6d29a':'#be965c');
        context.beginPath();context.ellipse(x,y,p.r,p.r*(1.15+Math.abs(gust)*.8),0,0,Math.PI*2);context.fill();
      }
      // A few defocused motes establish a foreground without becoming sparkles.
      for(const p of foreground){
        const x=((p.x*width+Math.sin(time*.06+p.phase)*48+currentScroll*.1)%width+width)%width;
        const y=((p.y*height-time*p.speed*7-currentScroll*.24)%height+height)%height;
        const visibility=Math.max(0,1-Math.pow((y/height-.4)/.45,2));
        const glow=context.createRadialGradient(x,y,0,x,y,p.r*2.5);
        glow.addColorStop(0,light?'rgba(145,108,65,.24)':'rgba(228,193,135,.2)');glow.addColorStop(.3,light?'rgba(171,135,87,.1)':'rgba(228,193,135,.08)');glow.addColorStop(1,light?'rgba(171,135,87,0)':'rgba(228,193,135,0)');
        context.globalAlpha=visibility*(quiet?.25:.65);context.fillStyle=glow;
        context.fillRect(x-p.r*2.5,y-p.r*2.5,p.r*5,p.r*5);
      }
      context.globalAlpha=1;context.globalCompositeOperation='source-over';
      if(!media.matches)frame=requestAnimationFrame(draw);
    };
    const start=()=>{if(!frame){last=performance.now();frame=requestAnimationFrame(draw)}};
    const resize=()=>{const rect=element.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(window.devicePixelRatio||1,mobile?1:1.5);element.width=Math.round(width*dpr);element.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);start()};
    const onScroll=()=>{scroll=window.scrollY};
    const onVisibility=()=>{if(!document.hidden)start();else{cancelAnimationFrame(frame);frame=0}};
    const onMotion=()=>{cancelAnimationFrame(frame);frame=0;start()};
    const themeObserver=new MutationObserver(()=>{light=document.documentElement.dataset.theme==='light';start()});
    themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else{cancelAnimationFrame(frame);frame=0}});
    observer.observe(element);
    const sizes=new ResizeObserver(resize);sizes.observe(element);
    window.addEventListener('scroll',onScroll,{passive:true});document.addEventListener('visibilitychange',onVisibility);media.addEventListener('change',onMotion);resize();
    return()=>{cancelAnimationFrame(frame);themeObserver.disconnect();observer.disconnect();sizes.disconnect();window.removeEventListener('scroll',onScroll);document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener('change',onMotion)};
  },[quiet]);
  return <canvas ref={canvas} className={quiet?'stage-air stage-air-quiet':'stage-air'} aria-hidden="true"/>;
}
