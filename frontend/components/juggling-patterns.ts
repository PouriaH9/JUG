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
  const wrapped=((seconds%2.28)+2.28)%2.28;
  const beat=wrapped/.38+ball*2;
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
    return {x:x*.72+crossing*.38,y:y*.9+.06*Math.sin(seconds*Math.PI/1.14+ball),z:direction*.6*Math.sin(Math.PI*u)};
  }
  return {x,y,z:direction*.5*Math.sin(Math.PI*u)};
}

// One complete pattern per turn, followed by a brief connecting movement.
export const TRICK_DURATIONS = [2.28, 1.8, 1.35, 2.28] as const;
export const TRICK_TRANSITION = .5;
export const TRICK_SEQUENCE_DURATION = TRICK_DURATIONS.reduce((sum,duration)=>sum+duration+TRICK_TRANSITION,0);

// Smooth the brief catch/release corners while preserving ballistic flight.
function flowingPosition(trick:number, seconds:number, ball:number):Position {
  const weights=[1,6,15,20,15,6,1];
  const result={x:0,y:0,z:0};
  for(let i=0;i<weights.length;i++){
    const p=trickPosition(trick,seconds+(i-3)*.014,ball);
    const weight=weights[i]/64;
    result.x+=p.x*weight;result.y+=p.y*weight;result.z+=p.z*weight;
  }
  return result;
}

export function jugglingPosition(seconds:number, ball:number) {
  let local = Math.max(0,seconds)%TRICK_SEQUENCE_DURATION;
  let index = 0;
  while(index<TRICK_DURATIONS.length-1 && local>=TRICK_DURATIONS[index]+TRICK_TRANSITION){
    local-=TRICK_DURATIONS[index]+TRICK_TRANSITION;
    index++;
  }
  const duration=TRICK_DURATIONS[index];
  // Both patterns keep moving throughout the handoff; neither freezes or resets.
  const a=flowingPosition(index,local+TRICK_TRANSITION,ball);
  const u=Math.min(1,Math.max(0,(local-duration)/TRICK_TRANSITION));
  const weight=u*u*u*(u*(u*6-15)+10);
  const b=flowingPosition((index+1)%JUGGLING_TRICKS.length,Math.max(0,local-duration),ball);
  return {index,x:a.x+(b.x-a.x)*weight,y:a.y+(b.y-a.y)*weight,z:a.z+(b.z-a.z)*weight};
}
