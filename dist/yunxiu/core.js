import{hasCurve,sampleCurve}from'../terrain-editor/curves.js?v=2';
import{regionRings}from'../terrain-editor/region-curves.js?v=1';
export const ALT_BASE=1700,MIN_X=-10000,MAX_X=10000,MIN_Z=-8000,MAX_Z=8000;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const hash=(x,z,seed=0)=>{let h=Math.imul(Math.floor(x),374761393)^Math.imul(Math.floor(z),668265263)^Math.imul(seed,1274126177);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295;};
export const worldPoint=p=>[(p[0]-10)*1000,(p[1]-8)*1000],designPoint=(x,z)=>[x/1000+10,z/1000+8];
export function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++)if((ring[i][1]>p[1])!==(ring[j][1]>p[1])&&p[0]<(ring[j][0]-ring[i][0])*(p[1]-ring[i][1])/(ring[j][1]-ring[i][1])+ring[i][0])yes=!yes;return yes;}
export function segment(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return{distance:Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t),t};}
export function sampleLine(f,step=.012){if(hasCurve(f))return sampleCurve(f,step);let out=[];for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let j=0;j<n;j++)out.push([mix(a[0],b[0],j/n),mix(a[1],b[1],j/n)]);}out.push(f.points.at(-1));return out;}
class Spatial{
 constructor(size=250){this.size=size;this.cells=new Map();}
 add(item,bounds){for(let z=Math.floor(bounds[1]/this.size);z<=Math.floor(bounds[3]/this.size);z++)for(let x=Math.floor(bounds[0]/this.size);x<=Math.floor(bounds[2]/this.size);x++){const k=x+':'+z;if(!this.cells.has(k))this.cells.set(k,[]);this.cells.get(k).push(item);}}
 at(x,z){return this.cells.get(Math.floor(x/this.size)+':'+Math.floor(z/this.size))||[];}
}
export class Geography{
 constructor(data,heights){this.data=data;this.heights=heights;this.features=data.features;this.regions=new Spatial(500);this.rivers=new Spatial(200);this.trails=new Spatial(200);this.lakes=[];this.paths=[];
  for(const f of this.features){if(['forest','grassland','meadow','lake','snow'].includes(f.type)&&f.closed){const rings=regionRings(f,.012).map(r=>r.map(worldPoint)),xs=rings[0].map(p=>p[0]),zs=rings[0].map(p=>p[1]),r={feature:f,rings,bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]};this.regions.add(r,r.bounds);if(f.type==='lake')this.lakes.push(r);}
   if(['river','trail'].includes(f.type)){const points=sampleLine(f,f.type==='trail'?.012:.018).map(worldPoint),path={feature:f,points};this.paths.push(path);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],s={a,b,feature:f},pad=f.type==='river'?Math.max(8,(f.width||25)/2+8):8;(f.type==='river'?this.rivers:this.trails).add(s,[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad]);}}
  }
  this.settlements=this.features.filter(f=>f.type==='village').map(f=>({feature:f,id:f.id,name:f.name,lodge:f.placeKind==='lodge',point:worldPoint(f.points[0])}));this.villages=this.settlements.filter(v=>!v.lodge);if(this.villages.length!==3)throw Error('定稿必须包含三个出生村庄');
  this.destinations=this.features.filter(f=>!f.hideLabel&&(['village','lake','waterfall','peak'].includes(f.type)||f.constraint==='saddle'||f.functionalArea)).map(f=>{const p=f.accessPoint||f.points.reduce((a,p)=>[a[0]+p[0]/f.points.length,a[1]+p[1]/f.points.length],[0,0]);return{id:f.id,name:f.name,type:f.type,point:worldPoint(p),elevation:f.elevation};});
 }
 height(x,z){const fx=clamp((x-MIN_X)/50,0,400),fz=clamp((z-MIN_Z)/50,0,320),i=Math.min(399,Math.floor(fx)),j=Math.min(319,Math.floor(fz)),u=fx-i,v=fz-j,k=j*401+i,a=this.heights;return(u+v<=1?a[k]*(1-u-v)+a[k+1]*u+a[k+401]*v:a[k+402]*(u+v-1)+a[k+401]*(1-u)+a[k+1]*(1-v))-ALT_BASE;}
 slope(x,z){const dx=(this.height(x+4,z)-this.height(x-4,z))/8,dz=(this.height(x,z+4)-this.height(x,z-4))/8;return{dx,dz,grade:Math.hypot(dx,dz),up:1/Math.sqrt(1+dx*dx+dz*dz)};}
 regionAt(x,z,type){for(const r of this.regions.at(x,z)){if(type&&r.feature.type!==type)continue;if(inside([x,z],r.rings[0])&&!r.rings.slice(1).some(h=>inside([x,z],h)))return r;}return null;}
 lineDistance(x,z,type='trail'){let best={distance:Infinity};for(const s of(type==='river'?this.rivers:this.trails).at(x,z)){const n=segment([x,z],s.a,s.b);if(n.distance<best.distance)best={...n,...s};}return best;}
 waterAt(x,z){const l=this.regionAt(x,z,'lake');if(l)return{height:l.feature.elevation-ALT_BASE,feature:l.feature,depth:l.feature.elevation-ALT_BASE-this.height(x,z)};const r=this.lineDistance(x,z,'river');if(r.feature&&r.distance<(r.feature.width||25)/2){const height=mix(this.height(...r.a),this.height(...r.b),r.t)+.22;return{height,feature:r.feature,depth:height-this.height(x,z)};}return null;}
 ecological(x,z){const h=this.height(x,z)+ALT_BASE,s=this.slope(x,z),g=this.data.ecology?.grid,[kx,kz]=designPoint(x,z),fx=clamp(kx*10-.5,0,199),fz=clamp(kz*10-.5,0,159),i=Math.min(198,Math.floor(fx)),j=Math.min(158,Math.floor(fz)),u=fx-i,v=fz-j,k=j*200+i,at=key=>{const a=g?.[key];return a?mix(mix(a[k],a[k+1],u),mix(a[k+200],a[k+201],u),v):0;};
  const exposure=g?at('exposure')/100:clamp(.8-s.dz*.2,.2,1.2),moisture=g?at('moisture')/100:.5,forestLine=Math.min(3500,g?at('forestLine'):3300),meadowLine=Math.min(4000,g?at('meadowLine'):3900),forest=!!this.regionAt(x,z,'forest'),meadow=!!this.regionAt(x,z,'meadow'),grassland=!!this.regionAt(x,z,'grassland');
  const tree=(forest?Math.max(.32,at('tree')/100):at('tree')/100*.018)*(1-smooth(forestLine-90,forestLine,h))*(1-smooth(.55,1.2,s.grade)),shrub=(at('shrub')/100+.08)*(1-smooth(meadowLine+30,meadowLine+120,h))*(1-smooth(.8,1.7,s.grade)),grass=(meadow||grassland||forest?Math.max(.35,at('grass')/100):at('grass')/100*.12)*(1-smooth(meadowLine-110,meadowLine,h))*(1-smooth(.65,1.2,s.grade));
  return{altitude:h,forestLine,meadowLine,tree,shrub,grass,moisture,exposure,grade:s.grade,up:s.up,forest,meadow,grassland,band:h>meadowLine?'高山岩地与积雪':h>forestLine?'高山灌丛与花甸':h>2850?'冷杉、云杉与山地桦林':'山地松、阔叶林与溪谷草坡'};
 }
 speciesAt(x,z,roll){const e=this.ecological(x,z);if(e.altitude>e.forestLine)return'juniper';if(e.altitude>e.forestLine-180)return roll<.5?'fir':roll<.8?'birch':'pine-small';if(e.altitude>2850)return roll<.44?'spruce':roll<.72?'fir':roll<.89?'birch':'pine';if(e.moisture>.64)return roll<.38?'birch':roll<.68?'broadleaf':'spruce';return roll<.45?'pine':roll<.73?'broadleaf':roll<.9?'birch':'fir';}
 chooseSpawn(random=Math.random){const n=clamp(Math.floor(random()*3),0,2),v=this.villages[n];return{villageId:v.id,name:v.name,x:v.point[0],z:v.point[1],y:this.height(...v.point)};}
 safePoint(x,z,radius=140,avoid=()=>false){
  for(let pass=0;pass<4;pass++){let best=null;const search=Math.min(4000,radius*Math.pow(2.5,pass));
   for(let i=0;i<110;i++){const a=i*2.39996,r=i?Math.sqrt(i/109)*search:0,px=clamp(x+Math.cos(a)*r,MIN_X+3,MAX_X-3),pz=clamp(z+Math.sin(a)*r,MIN_Z+3,MAX_Z-3),grade=this.slope(px,pz).grade;
    if(grade>.75||this.waterAt(px,pz)||avoid(px,pz))continue;const score=r+grade*80;if(!best||score<best.score)best={x:px,z:pz,y:this.height(px,pz),score};
   }if(best)return best;
  }
  throw Error('附近没有可安全落脚的位置，请选择另一处地点');
 }

}
export function moveGround(geo,position,dx,dz,collides=()=>false){let x=position.x,z=position.z;const valid=(a,b)=>{if(a<MIN_X+2||a>MAX_X-2||b<MIN_Z+2||b>MAX_Z-2||collides(a,b))return false;const w=geo.waterAt(a,b);if(w&&w.depth>.8)return false;const run=Math.hypot(a-x,b-z);return geo.height(a,b)-geo.height(x,z)<Math.max(.2,run*1.05);};if(valid(x+dx,z))x+=dx;if(valid(x,z+dz))z+=dz;return{x,z,y:geo.height(x,z)};}
