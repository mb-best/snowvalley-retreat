import{clone,clamp,fieldFor,elevationAt,contoursFrom,inside,distanceSegment,simplify,samplePath}from'./model.js?v=4';
import{smooth,path,nearest,ridge,crest,condition,drainageAudit}from'./watersheds.js?v=3';

const ROOT_IDS=['main-peak','west-peak','sw-peak','south-peak','north-peak','east-peak'];
export const ROOT_SPACING=.78,SATELLITE_SPACING=.55;
const passTargets={
 'pass-north-peak-main-peak':5030,'pass-main-peak-south-peak':5480,
 'pass-west-peak-main-peak':4900,'pass-west-peak-sw-peak':4850,
 'pass-main-peak-east-peak':4430,
 'cluster-pass-pines-rest-peak':4100,'cluster-pass-sleeping-cloud-peak':3900,
 'cluster-pass-clearing-cloud-peak':4310,'cluster-pass-sparse-stars-peak':3850,
 'cluster-pass-morning-clear-peak':4000,'cluster-pass-sunlit-peak':4200,
 'cluster-pass-mist-ferry-peak':3750,'cluster-pass-green-mist-peak':3960,
};
const mix=(a,b,t)=>a+(b-a)*t;
function ridgeTop(e,s){let first=s<=e.passS,t=first?s/e.passS:(e.length-s)/(e.length-e.passS),end=first?e.a.elevation:e.b.elevation;return e.height+(end-e.height)*(1-clamp(t,0,1))**1.25;}
function regionalFloor(x,y){return 2420+150*Math.sin(x*.22+y*.16)+130*Math.cos(y*.31)+360*Math.exp(-((x-16.5)**2/25+(y-1.8)**2/13))+1450*Math.exp(-((x-12.8)**2/13+(y-12.6)**2/10));}
function edgeDistance(x,y,f){if(inside([x,y],f.points))return 0;let d=Infinity;for(let n=0;n<f.points.length;n++)d=Math.min(d,distanceSegment([x,y],f.points[n],f.points[(n+1)%f.points.length]));return d;}
export function compactMassif(doc){
 if(doc.compactMassifVersion>=1)return false;
 const source=fieldFor(doc.features,401,321,400,doc.terrainBase),before=Object.fromEntries(doc.features.filter(f=>f.type==='peak').map(f=>[f.id,clone(f)])),anchor=before['main-peak']?.points[0];if(!anchor)return false;
 const rootPoint=p=>p.map((v,i)=>anchor[i]+(v-anchor[i])*ROOT_SPACING);
 const groupPoint=(p,id)=>{let old=before[id]?.points[0];if(!old)return rootPoint(p);let next=rootPoint(old);return p.map((v,i)=>next[i]+(v-old[i])*SATELLITE_SPACING);};
 for(let f of doc.features){
  if(f.type==='peak'&&ROOT_IDS.includes(f.id))f.points=[rootPoint(f.points[0])];
  else if(f.clusterParent)f.points=f.points.map(p=>groupPoint(p,f.clusterParent));
  else if(f.type==='ridge'||f.constraint==='saddle')f.points=f.points.map(rootPoint);
  if(f.type==='ridge'){f.baselinePoints=clone(f.points);f.baselineElevation=0;}
  if(f.constraint==='saddle'&&passTargets[f.id])f.elevation=Math.max(f.elevation,passTargets[f.id]);
 }
 const peaks=Object.fromEntries(doc.features.filter(f=>f.type==='peak').map(f=>[f.id,f]));
 let edges=(doc.terrainDesign?.ridgeConnections||[]).map(e=>{let a=peaks[e.from],b=peaks[e.to],pass=doc.features.find(f=>f.constraint==='saddle'&&f.name===e.pass);if(!a||!b||!pass)return null;pass.elevation=Math.min(pass.elevation,a.elevation-120,b.elevation-120);let bend=pass.points[0].map((v,i)=>v-(a.points[0][i]+b.points[0][i])/2);return{...ridge(a,b,pass.name,pass.elevation,bend),height:pass.elevation,kind:b.clusterParent?'spur':'root',passFeature:pass};}).filter(Boolean);
 const lakes=doc.features.filter(f=>f.type==='lake'),villages=doc.features.filter(f=>f.type==='village');
 const water=doc.features.filter(f=>f.type==='river').map(f=>{let points=samplePath(f,.085);return{...path(points),feature:f,levels:points.map(p=>elevationAt(source,...p))};});
 let field={nx:401,ny:321,values:new Array(401*321)},oldMountainPeaks=Object.values(before).filter(f=>ROOT_IDS.includes(f.id)||f.clusterParent);
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){
  let x=i*.05,y=j*.05,k=j*401+i,old=source.values[k],restore=0;
  // Remove the former far-reaching mountain shoulders as well as the old peak
  // positions. Otherwise the labels would move while their old masses remained.
  for(let p of oldMountainPeaks){let d=Math.hypot(x-p.points[0][0],y-p.points[0][1]),r=p.clusterParent?2.25:4.05;restore=Math.max(restore,1-smooth((d-r*.67)/(r*.33)));}
  let background=Math.min(old,regionalFloor(x,y)+35*Math.sin(x*1.7+y*.8)*Math.sin(y*1.4)),h=mix(old,background,restore);
  for(let e of edges){if(x<e.minX-3.6||x>e.maxX+3.6||y<e.minY-3.6||y>e.maxY+3.6)continue;let n=nearest(e,x,y),u=n.s/e.length,root=e.kind==='root',width=root?.78+.26*Math.sin(Math.PI*u):.69+.05*Math.sin(Math.PI*u),d=n.d/width,top=ridgeTop(e,n.s),shoulder=root?.30:.20,drop=(root?730:850)*(Math.sqrt(d*d+shoulder*shoulder)-shoulder)+(root?240:280)*d*d;
   let ribs=(root?105:55)*Math.sin(n.s*3.6+d*.9+n.side*.7)**6*smooth(d/.42),surface=top-drop-ribs;
   h=Math.max(h,surface);
  }
  // Keep the retained lake planes and settlement shelves, with a gradual bank
  // transition. The protected lake troughs are the deliberate local exceptions
  // to the raised inter-peak valley floors.
  for(let f of lakes){let d=edgeDistance(x,y,f);if(d<.75)h=mix(f.elevation+280*d+480*d*d,h,smooth((d-.07)/.68));}
  for(let f of villages){let d=Math.hypot(x-f.points[0][0],y-f.points[0][1]);if(d<.8)h=mix(f.elevation+95*d*d,h,smooth((d-.15)/.65));}
  // Reconnect only outside-facing river corridors. Inside the compact mountain
  // block, streams are refitted after drainage conditioning instead of cutting
  // a deep old channel through each newly raised saddle.
  for(let v of water){if(x<v.minX-1.5||x>v.maxX+1.5||y<v.minY-1.5||y>v.maxY+1.5)continue;let n=nearest(v,x,y);if(n.d>1.5)continue;let nearestRoot=Infinity;for(let id of ROOT_IDS){let p=peaks[id];if(p)nearestRoot=Math.min(nearestRoot,Math.hypot(x-p.points[0][0],y-p.points[0][1]));}let outside=smooth((nearestRoot-1.7)/.9),bed=mix(v.levels[n.index-1],v.levels[n.index],n.part),cap=bed+1100*n.d*n.d;h=mix(h,Math.min(h,cap),outside);}
  field.values[k]=Math.round(clamp(h,1750,8800)*10)/10;
 }
 // Pin the levels first, then fill small residual hollows. No new ridge cycles
 // are added; all fourteen named summits still share one acyclic skeleton.
 field.values=Array.from(fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,260,field).values,v=>Math.round(v*10)/10);
 let correction=condition(field);
 // In a compact group a neighbouring mountain shoulder may naturally support
 // a minor col above its initial target. Keep that real shared surface instead
 // of pinning an artificial depression into it.
 for(let e of edges.filter(e=>e.kind==='spur')){let p=e.passFeature.points[0],fx=p[0]*20,fy=p[1]*20,levels=[];for(let iy of [Math.floor(fy),Math.ceil(fy)])for(let ix of [Math.floor(fx),Math.ceil(fx)])levels.push(field.values[iy*401+ix]);let supported=Math.ceil(Math.max(...levels)/10)*10;e.passFeature.elevation=Math.max(e.passFeature.elevation,Math.min(supported,e.a.elevation-50,e.b.elevation-50));e.height=e.passFeature.elevation;}

 for(let attempt=0;attempt<3;attempt++){
  field.values=Array.from(fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,260,field).values,v=>Math.round(v*10)/10);
  let a=drainageAudit(field);if(a.maxDepth<.2||a.maxDepth>8)break;for(let k=0;k<field.values.length;k++)if(a.spill[k]-field.values[k]>.11){let level=field.values[k],q=a.parent[k];while(q>=0&&field.values[q]>level){field.values[q]=level;q=a.parent[q];}}
 }
 const flow=drainageAudit(field);let rerouted=[];
 for(let f of doc.features.filter(f=>f.type==='river')){let samples=samplePath(f,.05),hs=samples.map(p=>elevationAt(field,...p)),rise=0,run=0;for(let i=1;i<hs.length;i++){run=Math.max(0,run+hs[i]-hs[i-1]);rise=Math.max(rise,run);}if(rise<1)continue;let p=f.points[0],k=Math.round(p[1]*20)*401+Math.round(p[0]*20),points=[];for(let n=0;n<field.values.length&&k>=0;n++){points.push([k%401*.05,Math.floor(k/401)*.05]);k=flow.parent[k];}if(points.length>1){f.points=simplify(points,.012);f.flowDirection='points-order';rerouted.push(f.name);}}
 let contours=contoursFrom(field,doc.contourInterval||200,.018);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];doc.terrainBase=field;
 doc.compactMassifVersion=1;doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();doc.terrainDesign={...doc.terrainDesign,version:'compact-alpine-massif-1',compactLayout:{rootSpacingScale:ROOT_SPACING,satelliteSpacingScale:SATELLITE_SPACING,anchor:'main-peak'},ridgeConnections:edges.map(e=>({from:e.a.id,to:e.b.id,pass:e.passName,elevation:e.height})),drainage:correction,reroutedRivers:rerouted};
 doc.notes+=' 山系草案04：主山系峰间距收拢，低峰群缩短外伸距离，抬高鞍部与共同山肩，外围退让为森林草原山麓，保留湖泊与出山河谷。';return true;
}
