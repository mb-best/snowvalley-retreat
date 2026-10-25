import{clone,clamp,fieldFor,elevationAt,contoursFrom,inside,distanceSegment,simplify,samplePath}from'./model.js?v=4';
import{smooth,path,nearest,ridge,crest,condition,drainageAudit}from'./watersheds.js?v=3';

export const CLUSTER_PARENTS={
 'west-peak':{height:5180,scale:.68,radius:3.7},
 'north-peak':{height:5360,scale:.67,radius:3.6},
 'east-peak':{height:4860,scale:.69,radius:3.35},
};
// Offsets refer to the retained parent peaks, so each group follows the user's
// current layout. The western fans stay south of the existing northern river;
// the eastern fans stay between the two open east-flowing valley corridors.
const satelliteSpecs=[
 ['west-peak','pines-rest-peak','枕松峰',4380,[-2.05,-.95]],
 ['west-peak','sleeping-cloud-peak','眠云峰',4020,[-2.35,1.25]],
 ['north-peak','clearing-cloud-peak','霁云峰',4480,[-.55,-2.15]],
 ['north-peak','sparse-stars-peak','疏星峰',4080,[-.15,-4.15]],
 ['north-peak','morning-clear-peak','晓晴峰',4240,[1.70,-3.60]],
 ['east-peak','sunlit-peak','沐光峰',4440,[1.50,.40]],
 ['east-peak','mist-ferry-peak','岚渡峰',3980,[3.05,.60]],
 ['east-peak','green-mist-peak','青岚峰',4200,[1.70,-1.30]],
];
const spurSpecs=[
 ['west-peak','pines-rest-peak','松眠垭口',3940,[.0,-.08]],
 ['west-peak','sleeping-cloud-peak','眠云垭口',3630,[-.08,.03]],
 ['north-peak','clearing-cloud-peak','霁云垭口',4090,[-.05,0]],
 ['clearing-cloud-peak','sparse-stars-peak','疏星垭口',3670,[.05,-.02]],
 ['clearing-cloud-peak','morning-clear-peak','晓晴垭口',3760,[.05,.10]],
 ['east-peak','sunlit-peak','沐光垭口',4010,[.02,.08]],
 ['sunlit-peak','mist-ferry-peak','岚渡垭口',3540,[0,.03]],
 ['east-peak','green-mist-peak','青岚垭口',3740,[.0,-.06]],
];
const passHeights={
 'pass-north-peak-main-peak':4860,'pass-west-peak-main-peak':4660,
 'pass-west-peak-sw-peak':4520,'pass-main-peak-east-peak':4280,
};
const mix=(a,b,t)=>a+(b-a)*t;
function localFoot(source,p){let hs=Array.from({length:24},(_,i)=>{let a=i*Math.PI/12;return elevationAt(source,p[0]+Math.cos(a)*3.35,p[1]+Math.sin(a)*3.35);}).sort((a,b)=>a-b);return clamp(hs[6],2300,3350);}
function recontour(doc,field){let contours=contoursFrom(field,doc.contourInterval||200,.018);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];doc.terrainBase=field;}
export function redesignPeakClusters(doc){
 if(doc.peakClusterVersion>=2)return false;
 const source=fieldFor(doc.features,401,321,400,doc.terrainBase),parents=[];
 for(let[id,spec]of Object.entries(CLUSTER_PARENTS)){let f=doc.features.find(f=>f.id===id&&f.type==='peak');if(!f)continue;let p={...spec,id,point:[...f.points[0]],oldHeight:f.elevation,foot:localFoot(source,f.points[0])};parents.push(p);f.elevation=Math.min(f.elevation,spec.height);f.summitForm='compact-alpine-parent';}
 if(!parents.length)return false;
 // Retain peak positions, the central/southern massifs, every user region and
 // path. Only the three parent elevations and dependent pass heights change.
 const keptPeaks=doc.features.filter(f=>f.type==='peak'&&!CLUSTER_PARENTS[f.id]);
 for(let[id,h]of Object.entries(passHeights)){let f=doc.features.find(f=>f.id===id);if(f)f.elevation=Math.min(f.elevation,h);}
 for(let[parentId,id,name,elevation,offset]of satelliteSpecs){let parent=doc.features.find(f=>f.id===parentId);if(!parent||doc.features.some(f=>f.id===id))continue;doc.features.push({id,type:'peak',name,elevation,points:[[clamp(parent.points[0][0]+offset[0],.6,19.4),clamp(parent.points[0][1]+offset[1],.6,15.4)]],closed:false,clusterParent:parentId,summitForm:'outer-alpine-satellite'});}
 let peaks=Object.fromEntries(doc.features.filter(f=>f.type==='peak').map(f=>[f.id,f]));
 let spurs=spurSpecs.filter(([a,b])=>peaks[a]&&peaks[b]).map(([a,b,n,h,o])=>ridge(peaks[a],peaks[b],n,h,o));
 for(let l of spurs){let points=simplify(l.points,.018);doc.features.push({id:'cluster-ridge-'+l.b.id,type:'ridge',name:l.b.name.replace('峰','支脉'),points,closed:false,terrainRole:'crest',baselinePoints:clone(points),baselineElevation:0,clusterParent:l.b.clusterParent},{id:'cluster-pass-'+l.b.id,type:'label',constraint:'saddle',name:l.passName,elevation:l.height,points:[l.pass],closed:false,clusterParent:l.b.clusterParent});}
 let roots=(doc.terrainDesign?.ridgeConnections||[]).map(e=>{let a=peaks[e.from],b=peaks[e.to],f=doc.features.find(f=>f.constraint==='saddle'&&f.name===e.pass);if(!a||!b||!f||(!CLUSTER_PARENTS[a.id]&&!CLUSTER_PARENTS[b.id]))return null;let bend=f.points[0].map((v,i)=>v-(a.points[0][i]+b.points[0][i])/2);return ridge(a,b,f.name,f.elevation,bend);}).filter(Boolean);
 let water=doc.features.filter(f=>f.type==='river').map(f=>{let points=samplePath(f,.075);return{...path(points),levels:points.map(p=>elevationAt(source,...p))};});
 let lakes=doc.features.filter(f=>f.type==='lake'),villages=doc.features.filter(f=>f.type==='village');
 let field={nx:401,ny:321,values:Array.from(source.values)};
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){
  let x=i*.05,y=j*.05,k=j*401+i,old=source.values[k],h=old,amount=0,weight=0;
  for(let p of parents){let dx=x-p.point[0],dy=y-p.point[1],r=Math.hypot(dx,dy);if(r>=p.radius)continue;let w=1-smooth((r-1.15)/(p.radius-1.15));
   for(let peak of keptPeaks){let d=Math.hypot(x-peak.points[0][0],y-peak.points[0][1]);w*=smooth((d-.65)/1.25);}
   let reference=elevationAt(source,p.point[0]+dx/p.scale,p.point[1]+dy/p.scale),ratio=clamp((p.height-p.foot)/(p.oldHeight-p.foot),.35,1),target=p.foot+(reference-p.foot)*ratio;
   amount+=Math.min(0,target-old)*w;weight+=w;
  }
  h+=amount/Math.max(1,weight);
  // Re-form the affected connections with a broad saddle and reduced shoulders
  // near the smaller parent. The core of the central massif is not rescaled.
  for(let l of roots){let n=nearest(l,x,y),t=n.s/l.length,a=CLUSTER_PARENTS[l.a.id],b=CLUSTER_PARENTS[l.b.id],influence=a?1-smooth((t-.65)/.30):1-smooth(((1-t)-.65)/.30);if(influence<=0||n.d>2.1)continue;let scale=mix(1,.72,influence),d=n.d/scale,top=crest(l,n.s),target=top-790*(Math.sqrt(d*d+.32*.32)-.32)-125*d*d;let w=influence*(1-smooth((n.d-.65)/1.45));h=mix(h,Math.min(h,target),w);}
  for(let l of spurs){if(x<l.minX-2.2||x>l.maxX+2.2||y<l.minY-2.2||y>l.maxY+2.2)continue;let n=nearest(l,x,y),d=n.d*(1+.10*n.side*Math.sin(n.s*1.3)),top=crest(l,n.s),drop=1030*(Math.sqrt(d*d+.22*.22)-.22)+205*d*d,gully=85*Math.sin(n.s*4.1+d*1.4+n.side)**6*smooth(d/.35);h=Math.max(h,top-drop-gully);}
  // Keep the old stream beds and valley exits open under the new spurs. The
  // quadratic section gives tributaries a wide floor with rising valley walls.
  for(let v of water){if(x<v.minX-1.4||x>v.maxX+1.4||y<v.minY-1.4||y>v.maxY+1.4)continue;let n=nearest(v,x,y);if(n.d<1.4){let bed=mix(v.levels[n.index-1],v.levels[n.index],n.part),cap=bed+1250*n.d*n.d;h=Math.min(h,Math.max(old,cap));}}
  // A lake or settlement is a retained constraint, not a hole cut by a ridge.
  for(let f of [...lakes,...villages]){let d=f.type==='village'?Math.hypot(x-f.points[0][0],y-f.points[0][1])-.18:inside([x,y],f.points)?0:Math.min(...f.points.map((p,i)=>distanceSegment([x,y],p,f.points[(i+1)%f.points.length])));if(d<.55)h=mix(old,h,smooth(d/.55));}
  field.values[k]=Math.round(clamp(h,1750,8800)*10)/10;
 }
 // Solve retained level constraints against the new base, then condition tiny
 // local depressions before re-tracing every contour from the same heightfield.
 const constrained=fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,240,field);field.values=Array.from(constrained.values,v=>Math.round(v*10)/10);
 const correction=condition(field);
 // Shoreline interpolation can leave a one-cell sill after exact lake/settlement
 // constraints are reapplied. Breach only these sub-8 m artefacts downhill;
 // never use this correction to hide a blocked mountain valley.
 for(let attempt=0;attempt<3;attempt++){
  field.values=Array.from(fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,240,field).values,v=>Math.round(v*10)/10);
  let a=drainageAudit(field);if(a.maxDepth<.2||a.maxDepth>8)break;
  for(let k=0;k<field.values.length;k++)if(a.spill[k]-field.values[k]>.11){let level=field.values[k],q=a.parent[k];while(q>=0&&field.values[q]>level){field.values[q]=level;q=a.parent[q];}}
 }
 const flow=drainageAudit(field);
 // Refit only river tails whose old profile is affected, maintaining each source
 // and name. All lake boundaries, walking paths and vegetation remain intact.
 let rerouted=[];
 for(let f of doc.features.filter(f=>f.type==='river')){let samples=samplePath(f,.05),hs=samples.map(p=>elevationAt(field,...p)),rise=0,run=0;for(let i=1;i<hs.length;i++){run=Math.max(0,run+hs[i]-hs[i-1]);rise=Math.max(rise,run);}if(rise<1)continue;
  let p=f.points[0],k=Math.round(p[1]*20)*401+Math.round(p[0]*20),points=[];for(let n=0;n<field.values.length&&k>=0;n++){points.push([k%401*.05,Math.floor(k/401)*.05]);k=flow.parent[k];}if(points.length>1){f.points=simplify(points,.012);f.flowDirection='points-order';rerouted.push(f.name);}}
 recontour(doc,field);doc.peakClusterVersion=2;doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();
 let oldConnections=doc.terrainDesign?.ridgeConnections||[];
 doc.terrainDesign={...doc.terrainDesign,version:'alpine-peak-clusters-2',ridgeConnections:[...oldConnections.map(e=>({...e,elevation:doc.features.find(f=>f.constraint==='saddle'&&f.name===e.pass)?.elevation??e.elevation})),...spurs.map(l=>({from:l.a.id,to:l.b.id,pass:l.passName,elevation:l.height}))],peakGroups:parents.map(p=>({parent:p.id,oldHeight:p.oldHeight,height:peaks[p.id].elevation,horizontalScale:p.scale,satellites:doc.features.filter(f=>f.type==='peak'&&f.clusterParent===p.id).map(f=>f.id)})),drainage:correction,reroutedRivers:rerouted};
 doc.notes+=' 山系草案03：听雪峰、凝霜峰、照岚峰降低并收缩，外侧新增八座低峰，沿无环支脉分级展开，保留开放河谷与原有用户区域。';
 return true;
}
