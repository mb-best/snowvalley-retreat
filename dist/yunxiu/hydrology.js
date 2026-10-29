import{ALT_BASE,Spatial,clamp,mix,smooth,segment,inside,worldPoint}from'./core.js';
export const PERSON_HEIGHT=1.75,LAKE_DEPTH=PERSON_HEIGHT*5;
function edgeDistance(x,z,rings){let d=Infinity;for(const ring of rings)for(let i=0;i<ring.length;i++)d=Math.min(d,segment([x,z],ring[i],ring[(i+1)%ring.length]).distance);return d;}
function contains(x,z,rings){return inside([x,z],rings[0])&&!rings.slice(1).some(r=>inside([x,z],r));}
// One shared water/ground definition is used by rendering, swimming and collision.
// The approved footprint is retained; only beds and the immediate banks are repaired.
export class Hydrology{
 constructor(geo){this.geo=geo;this.lakes=new Spatial(500);this.streams=new Spatial(200);this.falls=[];this.tiles=new Set();this.lakeRecords=[];this.riverRecords=[];
  for(const lake of geo.lakes){const level=lake.feature.elevation-ALT_BASE,b=lake.bounds;let difference=0;
   for(const r of lake.rings)for(let i=0;i<r.length;i+=Math.max(1,Math.floor(r.length/40)))difference=Math.max(difference,Math.abs(geo.baseHeight(...r[i])-level));
   const shore=clamp(difference*1.4+35,45,280),record={...lake,level,shore,maxInset:1,deepest:null};
   for(let j=0;j<=15;j++)for(let i=0;i<=15;i++){const x=mix(b[0],b[2],i/15),z=mix(b[1],b[3],j/15);if(!contains(x,z,lake.rings))continue;const d=edgeDistance(x,z,lake.rings);if(d>record.maxInset){record.maxInset=d;record.deepest=[x,z];}}
   if(!record.deepest){const p=lake.rings[0][0];record.deepest=p;}
   this.lakeRecords.push(record);this.lakes.add(record,[b[0]-shore,b[1]-shore,b[2]+shore,b[3]+shore]);this.markTiles([b[0]-shore,b[1]-shore,b[2]+shore,b[3]+shore]);
  }
  for(const f of geo.features.filter(f=>f.type==='waterfall')){const a=worldPoint(f.points[0]),b=worldPoint(f.points[1]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),width=f.widthMetres||25;this.falls.push({feature:f,a,b,length,width,top:f.elevation-ALT_BASE,bottom:f.elevation-ALT_BASE-f.drop});}
  for(const path of geo.paths.filter(p=>p.feature.type==='river')){
   const points=path.points,levels=points.map(p=>geo.baseHeight(...p)),width=path.feature.width||25;
   // River data runs upstream -> downstream. Constrain the profile with isotonic
   // least squares, instead of repeatedly lowering all later points at one bump.
   const blocks=[];for(let i=0;i<levels.length;i++){const point=points[i];let value=levels[i],anchor=null,nearest=30;
    for(const lake of this.lakes.at(...point)){const inside=contains(...point,lake.rings),distance=inside?0:edgeDistance(...point,lake.rings);if(distance<nearest){nearest=distance;anchor=lake.level;}}
    for(const f of this.falls){const dx=f.b[0]-f.a[0],dz=f.b[1]-f.a[1],t=((point[0]-f.a[0])*dx+(point[1]-f.a[1])*dz)/(f.length*f.length),cross=Math.abs((point[0]-f.a[0])*dz-(point[1]-f.a[1])*dx)/f.length;if(cross<f.width){if(t>=0&&t<=1)anchor=mix(f.top,f.bottom,t);else if(t>1&&(t-1)*f.length<40){value=mix(f.bottom,value,smooth(0,40,(t-1)*f.length));}}}
    if(anchor!==null)value=anchor;blocks.push({start:i,end:i,sum:value,weight:1,anchor});
    const mean=b=>b.anchor??b.sum/b.weight;while(blocks.length>1&&mean(blocks.at(-2))<mean(blocks.at(-1))){const q=blocks.pop(),p=blocks.at(-1);p.end=q.end;p.sum+=q.sum;p.weight+=q.weight;if(q.anchor!==null)p.anchor=p.anchor===null?q.anchor:Math.max(p.anchor,q.anchor);}
   }
   for(const b of blocks)for(let i=b.start;i<=b.end;i++)levels[i]=b.anchor??b.sum/b.weight;
   const river={feature:path.feature,points,levels,width};this.riverRecords.push(river);
   for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],r={a,b,ha:levels[i-1],hb:levels[i],river,feature:path.feature,width};const pad=width/2+35,bounds=[Math.min(a[0],b[0])-pad,Math.min(a[1],b[1])-pad,Math.max(a[0],b[0])+pad,Math.max(a[1],b[1])+pad];this.streams.add(r,bounds);this.markTiles(bounds);}
  }
  geo.hydrology=this;
 }
 markTiles(bounds){for(let j=Math.max(0,Math.floor((bounds[1]+8000)/100));j<=Math.min(159,Math.floor((bounds[3]+8000)/100));j++)for(let i=Math.max(0,Math.floor((bounds[0]+10000)/100));i<=Math.min(199,Math.floor((bounds[2]+10000)/100));i++)this.tiles.add(i+':'+j);}
 lakeAt(x,z){for(const l of this.lakes.at(x,z))if(contains(x,z,l.rings))return l;return null;}
 fallAt(x,z,pad=0){for(const f of this.falls){const dx=f.b[0]-f.a[0],dz=f.b[1]-f.a[1],t=((x-f.a[0])*dx+(z-f.a[1])*dz)/(f.length*f.length),cross=Math.abs((x-f.a[0])*dz-(z-f.a[1])*dx)/f.length;if(t>=0&&t<=1&&cross<f.width/2+pad)return{...f,t,cross,height:mix(f.top,f.bottom,t)};}return null;}
 riverAt(x,z,pad=0){let best=null;for(const r of this.streams.at(x,z)){const q=segment([x,z],r.a,r.b);if(q.distance<r.width/2+pad&&(!best||q.distance<best.distance))best={...r,...q};}return best;}
 riverLevel(r,x,z){const l=this.lakeAt(x,z);if(l)return l.level;const f=this.fallAt(x,z);return f?f.height:mix(r.ha,r.hb,r.t);}
 water(x,z){const fall=this.fallAt(x,z);if(fall)return{height:fall.height,feature:fall.feature,kind:'fall'};const l=this.lakeAt(x,z);if(l)return{height:l.level,feature:l.feature,kind:'lake'};const r=this.riverAt(x,z);return r?{height:this.riverLevel(r,x,z),feature:r.feature,kind:'river'}:null;}
 ground(x,z){const base=this.geo.baseHeight(x,z),fall=this.fallAt(x,z,10);if(fall){if(fall.cross<fall.width/2)return fall.height-.35;return mix(base,fall.height+.08,1-smooth(fall.width/2,fall.width/2+10,fall.cross));}
  let lakeBed=Infinity;for(const l of this.lakes.at(x,z))if(contains(x,z,l.rings)){const d=edgeDistance(x,z,l.rings),depth=LAKE_DEPTH*smooth(0,Math.max(4,l.maxInset),d);lakeBed=Math.min(lakeBed,l.level-depth);}if(lakeBed<Infinity)return lakeBed;
  let result=base,weight=0;for(const lake of this.lakes.at(x,z)){const d=edgeDistance(x,z,lake.rings);if(d>=lake.shore)continue;const t=1-smooth(0,lake.shore,d);if(t>weight){result=mix(base,lake.level+Math.min(d*.075,2),t);weight=t;}}
  const r=this.riverAt(x,z,35);if(r){const half=r.width/2,level=this.riverLevel(r,x,z),t=clamp(r.distance/half,0,1),bed=level-1.5*(1-smooth(0,1,t));if(r.distance<=half)return bed;const bank=1-smooth(half,half+35,r.distance);result=mix(result,level+Math.min(1,(r.distance-half)*.08),bank*(1-weight));}
  return result;
 }
}
