import{clone,clamp,fieldFor,elevationAt,contoursFrom,distanceSegment,inside,samplePath}from'./model.js?v=4';
import{smooth,drainageAudit}from'./watersheds.js?v=3';
export const INWARD_FRACTION=.10,MAX_MOVE_KM=.35;
const roots=['main-peak','west-peak','sw-peak','south-peak','north-peak','east-peak'];
const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
function polygonDistance(p,f){if(inside(p,f.points))return 0;let d=Infinity;for(let i=0;i<f.points.length;i++)d=Math.min(d,distanceSegment(p,f.points[i],f.points[(i+1)%f.points.length]));return d;}
export function gentlyMoveSatellites(doc){
 if(doc.gentleSatelliteVersion>=2)return false;
 if(doc.compactMassifVersion)throw Error('请先恢复峰群草案03，再应用低峰微调。');
 const before=clone(doc.features),source=fieldFor(doc.features,401,321,400,doc.terrainBase),parents=Object.fromEntries(before.filter(f=>roots.includes(f.id)).map(f=>[f.id,f.points[0]]));
 const transform=(point,id)=>{let p=parents[id];if(!p)return point;let dx=point[0]-p[0],dy=point[1]-p[1],r=Math.hypot(dx,dy),amount=Math.min(r*INWARD_FRACTION,MAX_MOVE_KM)/(r||1);return[point[0]-dx*amount,point[1]-dy*amount];};
 let controls=[],moves=[];
 for(let f of doc.features.filter(f=>f.clusterParent)){
  let old=clone(f.points);f.points=f.points.map(p=>transform(p,f.clusterParent));
  let samples=f.type==='ridge'?samplePath({...f,points:old},.30):old;
  for(let p of samples){let next=transform(p,f.clusterParent);controls.push({old:p,next,delta:next.map((v,i)=>v-p[i])});}
  if(f.type==='ridge'){f.baselinePoints=clone(f.points);f.baselineElevation=0;}
  if(f.type==='peak')moves.push({id:f.id,name:f.name,from:old[0],to:f.points[0],metres:Math.round(Math.hypot(f.points[0][0]-old[0][0],f.points[0][1]-old[0][1])*1000)});
 }
 if(!moves.length)return false;
 const major=before.filter(f=>f.type==='ridge'&&!f.clusterParent),water=before.filter(f=>f.type==='river'),lakes=before.filter(f=>f.type==='lake'),villages=before.filter(f=>f.type==='village');
 const protection=(x,y)=>{let p=[x,y],keep=1;
  for(let point of Object.values(parents))keep=Math.min(keep,smooth((Math.hypot(x-point[0],y-point[1])-.45)/.25));
  for(let f of major){let d=Infinity;for(let i=1;i<f.points.length;i++)d=Math.min(d,distanceSegment(p,f.points[i-1],f.points[i]));keep=Math.min(keep,smooth((d-.10)/.18));}
  for(let f of water){let d=Infinity;for(let i=1;i<f.points.length;i++)d=Math.min(d,distanceSegment(p,f.points[i-1],f.points[i]));keep=Math.min(keep,smooth((d-.10)/.24));}
  for(let f of lakes)keep=Math.min(keep,smooth((polygonDistance(p,f)-.12)/.22));
  for(let f of villages)keep=Math.min(keep,smooth((Math.hypot(x-f.points[0][0],y-f.points[0][1])-.25)/.30));
  return keep;
 };
 let values=Array.from(source.values),gates=new Float32Array(values.length);
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){
  let x=i*.05,y=j*.05,k=j*401+i,dx=0,dy=0,sum=1,nearest=Infinity;
  for(let c of controls){let d=Math.hypot(x-c.next[0],y-c.next[1]);nearest=Math.min(nearest,d);if(d>=1.35)continue;let w=(1-smooth(d/1.35))**2/(d*d+.0004);dx+=c.delta[0]*w;dy+=c.delta[1]*w;sum+=w;}
  if(nearest>=1.35)continue;let lowDistance=Math.min(...moves.map(m=>Math.min(Math.hypot(x-m.from[0],y-m.from[1]),Math.hypot(x-m.to[0],y-m.to[1]))));if(lowDistance>=2.25)continue;let keep=protection(x,y)*(1-smooth((lowDistance-1.4)/.85)),gate=(1-smooth((nearest-.45)/.90))*keep;gates[k]=gate;
  if(keep)values[k]=elevationAt(source,x-dx/sum*keep,y-dy/sum*keep);
 }
 // Only relax the small moved-peak neighbourhoods. There is no new background
 // terrain, no scaling of major mountains, and no global valley reconditioning.
 let raw={nx:401,ny:321,values},solved=fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,240,raw);
 for(let k=0;k<values.length;k++)values[k]=gates[k]?values[k]+(solved.values[k]-values[k])*gates[k]:source.values[k];
 const pinMovingPoints=()=>{for(let f of doc.features.filter(f=>f.clusterParent&&(f.type==='peak'||f.constraint==='saddle'))){let[x,y]=f.points[0],fx=x*20,fy=y*20;for(let iy of[Math.floor(fy),Math.ceil(fy)])for(let ix of[Math.floor(fx),Math.ceil(fx)])values[iy*401+ix]=f.elevation;}};
 pinMovingPoints();
 for(let attempt=0;attempt<3;attempt++){let a=drainageAudit(raw);if(a.maxDepth<.2)break;for(let k=0;k<values.length;k++)if(a.spill[k]-values[k]>.11&&gates[k]>0)values[k]=a.spill[k];pinMovingPoints();let b=drainageAudit(raw);if(b.maxDepth<.2)break;
  for(let k=0;k<values.length;k++)if(b.spill[k]-values[k]>.11&&gates[k]>0){let level=values[k],q=b.parent[k];while(q>=0&&gates[q]>0&&values[q]>level){values[q]=level;q=b.parent[q];}}
 }
 let field={nx:401,ny:321,values:values.map((h,k)=>gates[k]?Math.round(h*10)/10:source.values[k])};
 let contours=contoursFrom(field,doc.contourInterval||200,.018);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}
 doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];doc.terrainBase=field;doc.gentleSatelliteVersion=2;doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();
 doc.terrainDesign={...doc.terrainDesign,version:'alpine-clusters-gentle-2',gentleSatelliteAdjustment:{fraction:INWARD_FRACTION,maxMoveMetres:MAX_MOVE_KM*1000,moves,majorMountains:'unchanged',terrainMethod:'local-inverse-deformation'}};
 doc.notes+=' 峰群草案03低峰微调：仅将八座低峰向内小幅移动，保留大峰及原有地貌，仅在低峰邻近范围变形衔接。';return true;
}
