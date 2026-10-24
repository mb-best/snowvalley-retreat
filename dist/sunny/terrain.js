export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
export function random(seed=1423){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function noise(x,z){return Math.sin(x*.63+Math.sin(z*.47))*Math.cos(z*.57+Math.sin(x*.41))*.55+Math.sin(x*.27+z*.22)*.45}
export const riverX=z=>3+7*Math.sin(z*.032)-z*.075+1.1*Math.sin(z*.083);
export const waterY=z=>.22-z*.008;
export const riverWidth=z=>3.2+.5*Math.sin(z*.062+2)+.2*Math.sin(z*.2);
export function groundHeight(x,z){
  let h=1.8+1.35*Math.sin(x*.031+1)*Math.cos(z*.023)+.65*Math.sin(z*.064)+.045*noise(x*.6,z*.6);
  h+=4.5*Math.exp(-((x-30)**2/800+(z+5)**2/1600));
  h+=9*Math.exp(-((x+74)**2/1800+(z+72)**2/2300));
  h+=15*Math.exp(-((x-82)**2/2200+(z+104)**2/1800));
  h+=26*Math.exp(-((x+30)**2/7000+(z+190)**2/2500));
  const pad=1-smooth(4.8,10,Math.hypot((x+19)*.9,z+19));
  h=mix(h,3.2,pad);
  const d=Math.abs(x-riverX(z)),w=riverWidth(z);
  return mix(waterY(z)-.65,h,smooth(w-.6,w+6.0,d));
}
const route=[[-36,90],[-28,57],[-13,31],[4,9],[-10,-4],[-19,-12]];
export const pathPoints=[];
for(let i=0;i<route.length-1;i++)for(let s=0;s<24;s++){
  const t=s/24,a=route[Math.max(0,i-1)],b=route[i],c=route[i+1],d=route[Math.min(route.length-1,i+2)];
  const point=k=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t);
  pathPoints.push([point(0),point(1)]);
}
pathPoints.push(route.at(-1));
const branch=[[4,9],[16,2],[27,-8],[36,-20]];
for(let i=0;i<branch.length-1;i++)for(let s=0;s<16;s++){const t=s/16;pathPoints.push([mix(branch[i][0],branch[i+1][0],t),mix(branch[i][1],branch[i+1][1],t)])}
export function pathDistance(x,z){let best=1000;for(const p of pathPoints)best=Math.min(best,Math.hypot(x-p[0],z-p[1]));return best}
export const cottage={x:-19,z:-19,y:3.2};
export const bridge={x:riverX(9),z:9,y:waterY(9)+1.12};
export function walkHeight(x,z){if(Math.abs(z-bridge.z)<1.75&&Math.abs(x-bridge.x)<6.6)return bridge.y+.52*(1-((x-bridge.x)/6.6)**2)+.12;return groundHeight(x,z)}
export function canWalk(x,z){
  if(x < -92 || x>92 || z < -120 || z>105)return false;
  if(Math.abs(x+19)<4.25&&Math.abs(z+19)<4.2)return false;
  const inBridge=Math.abs(z-bridge.z)<1.5&&Math.abs(x-bridge.x)<6.8;
  return inBridge||Math.abs(x-riverX(z))>riverWidth(z)-.15;
}
