export const JUGGLING_TRICKS = ['Columns', 'Cascade', 'Shower', 'Mills Mess'] as const;
export type JugglingTrick = typeof JUGGLING_TRICKS[number];
type Position = {x:number;y:number;z:number};
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*t*(t*(t*6-15)+10);};
const FLIGHT=[1.4,1.22,1.12,1.22] as const;
// Two complete repeats: columns has one throw per repeat; other tricks use two.
const THROWS=[2,4,4,4] as const;
export const TRICK_TRANSITION=.48;
function delay(trick:number,ball:number){return trick===0?(ball===1?FLIGHT[0]/2:0):ball*FLIGHT[trick]/3;}
export const TRICK_DURATIONS=FLIGHT.map((flight,i)=>THROWS[i]*flight+Math.max(...[0,1,2].map(ball=>delay(i,ball))));
export const TRICK_SEQUENCE_DURATION=TRICK_DURATIONS.reduce((sum,duration)=>sum+duration+TRICK_TRANSITION,0);

// Quintic catch/release joins match the parabola's position, speed and acceleration.
// The central 76% of each throw follows constant downward acceleration.
function liftAt(u:number):number {
  const edge=.12;
  const t=Math.min(clamp(u),1-clamp(u));
  if(t>=edge)return 4*u*(1-u);
  const q=t/edge;
  const p=4*edge*(1-edge),v=(4-8*edge)*edge,a=-8*edge*edge;
  const c3=10*p-4*v+a/2,c4=-15*p+7*v-a,c5=6*p-3*v+a/2;
  return c3*q**3+c4*q**4+c5*q**5;
}
function handX(trick:number,ball:number,throwNumber:number){
  if(trick===0)return ball-1;
  if(trick===2)return throwNumber%2===0?-1:1;
  const initial=ball%2===0?-1:1;
  return initial*(throwNumber%2===0?1:-1);
}
function bottom(trick:number,ball:number):Position{return {x:handX(trick,ball,0),y:0,z:0};}

/** Each ball completes both repeats, catches at the baseline, then waits in the hand. */
export function trickPosition(trick:number,seconds:number,ball:number):Position {
  const elapsed=seconds-delay(trick,ball),flight=FLIGHT[trick];
  if(elapsed<=0)return bottom(trick,ball);
  if(elapsed>=THROWS[trick]*flight)return bottom(trick,ball);
  const n=Math.floor(elapsed/flight),u=(elapsed-n*flight)/flight;
  const from=handX(trick,ball,n),to=handX(trick,ball,n+1);
  const arc=liftAt(u),travel=smooth(u);
  let x=from+(to-from)*travel;
  let y=arc;
  let z=0;
  if(trick===1)z=(from<0?1:-1)*.3*arc;
  if(trick===2){y*=n%2===0?1.05:.16;z=n%2===0?.12*arc:-.35*arc;}
  if(trick===3){
    // Ball-only crossing interpretation; every throw still starts/ends in a hand.
    x=x+(n%2===0?1:-1)*.32*Math.sin(2*Math.PI*travel)*arc;
    y*=.98;z=(from<0?1:-1)*.55*arc;
  }
  return {x,y,z};
}

export function jugglingPosition(seconds:number,ball:number){
  let local=Math.max(0,seconds)%TRICK_SEQUENCE_DURATION;
  let index=0;
  while(index<3 && local>=TRICK_DURATIONS[index]+TRICK_TRANSITION){local-=TRICK_DURATIONS[index]+TRICK_TRANSITION;index++;}
  const duration=TRICK_DURATIONS[index];
  if(local<=duration)return {index,...trickPosition(index,local,ball)};
  // All three balls have landed. Change hand positions only along the bottom line.
  const weight=smooth((local-duration)/TRICK_TRANSITION);
  const from=bottom(index,ball),to=bottom((index+1)%4,ball);
  return {index,x:from.x+(to.x-from.x)*weight,y:0,z:0};
}
