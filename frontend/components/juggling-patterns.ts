export const JUGGLING_TRICKS = ['Cascade', 'Shower', 'Columns', 'Mills Mess'] as const;
export type JugglingTrick = typeof JUGGLING_TRICKS[number];
type Position = { x:number; y:number; z:number };
const smooth = (t:number) => t*t*(3-2*t);

/** Unit trajectories; vertical flights use constant gravitational acceleration. */
export function trickPosition(trick:number, seconds:number, ball:number):Position {
  if (trick === 1) {
    // Shower: high left-to-right throws, quick low right-to-left passes.
    const phase = ((seconds / 1.8 + ball / 3) % 1 + 1) % 1;
    const split = .79;
    if (phase < split) {
      const u=phase/split;
      return {x:-1+2*u,y:4*u*(1-u),z:.12*Math.sin(Math.PI*u)};
    }
    const u=(phase-split)/(1-split);
    return {x:1-2*u,y:.09*4*u*(1-u),z:-.35*Math.sin(Math.PI*u)};
  }
  if (trick === 2) {
    // Columns: the two outer throws alternate with the centre throw.
    const phase=((seconds/1.35+(ball===1?.5:0))%1+1)%1;
    const u=Math.min(phase/.88,1);
    return {x:ball-1,y:4*u*(1-u)-.035*Math.sin(Math.max(0,(phase-.88)/.12)*Math.PI),z:0};
  }
  const beat=seconds/.38+ball*2;
  const direction=Math.floor(beat/3)%2===0?1:-1;
  const phase=(beat%3)/3;
  const u=Math.min(phase/.86,1);
  const catchPhase=Math.max(0,(phase-.86)/.14);
  const scoop=smooth(catchPhase);
  const x=phase<.86?direction*(-.68+1.68*u):direction*(1-.32*scoop);
  const y=4*u*(1-u)-.035*Math.sin(catchPhase*Math.PI);
  if (trick === 3) {
    // Ball-only Mills Mess interpretation: alternating crossed, moving throw lanes.
    const crossing=Math.sin(seconds*Math.PI/1.14);
    return {x:x*.72+crossing*.38,y:y*.9+.06*Math.sin(seconds*2+ball),z:direction*.6*Math.sin(Math.PI*u)};
  }
  return {x,y,z:direction*.5*Math.sin(Math.PI*u)};
}

export function jugglingPosition(seconds:number, ball:number) {
  const cycle=Math.max(0,seconds)/10;
  const index=Math.floor(cycle)%JUGGLING_TRICKS.length;
  const blend=Math.max(0,(cycle%1-.88)/.12);
  const weight=smooth(blend);
  const a=trickPosition(index,seconds,ball);
  const b=trickPosition((index+1)%4,seconds,ball);
  return {index,x:a.x+(b.x-a.x)*weight,y:a.y+(b.y-a.y)*weight,z:a.z+(b.z-a.z)*weight};
}
