import{clamp,elevationAt,inside,distanceSegment}from'./model.js?v=6';
import{Heap,center,distance,mix,lineSamples}from'./landscape-hydrology.js?v=1';
function lakeDistance(p,l){return inside(p,l.points)?0:Math.min(...l.points.map((q,i)=>distanceSegment(p,q,l.points[(i+1)%l.points.length])));}
export function addEstates(doc,field){let lakes=doc.features.filter(f=>f.type==='lake'),specs=[{id:'estate-tingsong',name:'听松山庄',aim:[3.9,4.55],bounds:[2.8,4.25,4.9,5.5]},{id:'estate-qinglan',name:'晴岚山庄',aim:[11.5,4.0],bounds:[10.5,3.4,12.5,4.55],lake:doc.features.find(f=>f.id==='lake-east')}];for(let s of specs){if(doc.features.some(f=>f.id===s.id))continue;let best=null,score=Infinity;for(let y=s.bounds[1];y<s.bounds[3];y+=.05)for(let x=s.bounds[0];x<s.bounds[2];x+=.05){let p=[x,y],h=elevationAt(field,x,y),slope=Math.hypot(elevationAt(field,x+.05,y)-elevationAt(field,x-.05,y),elevationAt(field,x,y+.05)-elevationAt(field,x,y-.05))/100;if(lakes.some(l=>lakeDistance(p,l)<.12))continue;if(s.lake&&(lakeDistance(p,s.lake)>.6||y>center(s.lake)[1]))continue;let c=distance(p,s.aim)+slope*2+Math.max(0,h-3500)/400;if(c<score){score=c;best={p,h};}}if(!best)throw Error('山庄选址未找到适合的湖岸陆地。');doc.features.push({id:s.id,type:'village',placeKind:'lodge',name:s.name,points:[best.p],closed:false,elevation:Math.round(best.h),terrainConstraint:'none'});}}
export function trailStats(field,points){let ps=lineSamples(points,.02),up=0,down=0,length=0,grades=[];for(let i=1;i<ps.length;i++){let d=distance(ps[i-1],ps[i])*1000,dh=elevationAt(field,...ps[i])-elevationAt(field,...ps[i-1]);if(d<.01)continue;up+=Math.max(0,dh);down+=Math.max(0,-dh);length+=d;grades.push(Math.abs(dh)/d);}grades.sort((a,b)=>a-b);return{lengthKm:length/1000,ascentMetres:up,descentMetres:down,p95Grade:grades[Math.floor(grades.length*.95)]||0,maxGrade:grades.at(-1)||0};}
// All route geometry uses the same bilinear height field as the editor/3D view.
// Percentage grade = rise / horizontal distance (50% is about 26.6 degrees).
export function terrainGradient(field,p){
 const sx=20/(field.nx-1),sy=16/(field.ny-1),fx=clamp(p[0]/sx,0,field.nx-1),fy=clamp(p[1]/sy,0,field.ny-1),i=Math.min(field.nx-2,Math.floor(fx)),j=Math.min(field.ny-2,Math.floor(fy)),u=fx-i,v=fy-j,k=j*field.nx+i,a=field.values[k],b=field.values[k+1],c=field.values[k+field.nx],d=field.values[k+field.nx+1];
 return[((b-a)*(1-v)+(d-c)*v)/(sx*1000),((c-a)*(1-u)+(d-b)*u)/(sy*1000)];
}
export const HIKING_RULES={maxGrade:.5,climbContourAngle:45,passContourAngle:60,passRadiusKm:.65,contourSlopeThreshold:.08};
export function hikingContext(doc,field){
 const nx=401,ny=321,step=.05,N=nx*ny,point=k=>[k%nx*step,Math.floor(k/nx)*step],key=p=>Math.round(p[1]/step)*nx+Math.round(p[0]/step),lakes=doc.features.filter(f=>f.type==='lake'),passes=doc.features.filter(f=>f.constraint==='saddle').map(f=>f.points[0]),water=new Uint8Array(N),passZone=new Uint8Array(N),heights=new Float64Array(N);
 for(let k=0;k<N;k++){let p=point(k);water[k]=lakes.some(l=>inside(p,l.points))?1:0;passZone[k]=passes.some(q=>distance(p,q)<HIKING_RULES.passRadiusKm)?1:0;heights[k]=elevationAt(field,...p);}
 // Keep a 50 m bank margin. This is also used when smoothing, not only in search.
 let wet=water.slice();for(let k=0;k<N;k++)if(wet[k]){let x=k%nx,y=Math.floor(k/nx);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<nx&&y+dy>=0&&y+dy<ny)water[(y+dy)*nx+x+dx]=1;}
 return{doc,field,nx,ny,step,N,point,key,lakes,passes,water,passZone,heights};
}
export function trailSegmentAudit(ctx,a,b,spacing=.005,margin=0){
 const len=distance(a,b);if(len<1e-10)return{valid:!ctx.water[ctx.key(a)],maxGrade:0,maxOrdinaryAngle:0,maxPassAngle:0};
 const vx=b[0]-a[0],vy=b[1]-a[1],dx=vx/len,dy=vy/len,cuts=[0,1];
 const add=t=>{if(t>1e-9&&t<1-1e-9)cuts.push(t);};
 // Split at every surface cell and nearest-cell water-mask boundary. On each
 // resulting interval the surface gradient is affine along this straight line.
 for(let axis=0;axis<2;axis++){let d=b[axis]-a[axis];if(Math.abs(d)<1e-10)continue;for(let offset of[0,.025])for(let i=Math.ceil((Math.min(a[axis],b[axis])-offset)/.05);i<=Math.floor((Math.max(a[axis],b[axis])-offset)/.05);i++)add((i*.05+offset-a[axis])/d);}
 for(let q of ctx.passes){let ax=a[0]-q[0],ay=a[1]-q[1],dot=ax*vx+ay*vy,c=ax*ax+ay*ay-HIKING_RULES.passRadiusKm**2,disc=dot*dot-len*len*c;if(disc>0){let r=Math.sqrt(disc);add((-dot-r)/(len*len));add((-dot+r)/(len*len));}}
 cuts.sort((a,b)=>a-b);let maxGrade=0,maxOrdinaryAngle=0,maxPassAngle=0;
 for(let i=1;i<cuts.length;i++){let lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-10)continue;let mid=mix(a,b,(lo+hi)/2);if(ctx.water[ctx.key(mid)])return{valid:false,reason:'water',maxGrade,maxOrdinaryAngle,maxPassAngle};
  let isPass=ctx.passes.some(q=>distance(mid,q)<HIKING_RULES.passRadiusKm),limit=isPass?60:45,g0=terrainGradient(ctx.field,mix(a,b,lo+(hi-lo)*1e-7)),g1=terrainGradient(ctx.field,mix(a,b,hi-(hi-lo)*1e-7)),gx=g0[0],gy=g0[1],bx=g1[0]-gx,by=g1[1]-gy,r=gx*dx+gy*dy,z=bx*dx+by*dy,u=gx*gx+gy*gy,v=gx*bx+gy*by,w=bx*bx+by*by;
  let grade=Math.max(Math.abs(r),Math.abs(r+z));maxGrade=Math.max(maxGrade,grade);if(grade>.5-margin+1e-9)return{valid:false,reason:'grade',maxGrade,maxOrdinaryAngle,maxPassAngle};
  let candidates=[0,1],den=z*v-r*w;if(Math.abs(den)>1e-16){let t=(r*v-z*u)/den;if(t>0&&t<1)candidates.push(t);}
  // A flat surface has no stable contour bearing. Include both points where
  // its slope reaches the documented 8% threshold, so no narrow interval hides
  // a contour-angle violation between regular samples.
  let c=u-HIKING_RULES.contourSlopeThreshold**2,disc=v*v-w*c;if(w>1e-16&&disc>=0){let rr=Math.sqrt(disc);for(let t of[(-v-rr)/w,(-v+rr)/w])if(t>0&&t<1)candidates.push(t);}
  for(let t of candidates){let slope=Math.hypot(gx+bx*t,gy+by*t),angle=slope>=HIKING_RULES.contourSlopeThreshold-1e-10?Math.asin(clamp(Math.abs(r+z*t)/slope,0,1))*180/Math.PI:0;if(isPass)maxPassAngle=Math.max(maxPassAngle,angle);else maxOrdinaryAngle=Math.max(maxOrdinaryAngle,angle);if(angle>limit+1e-5)return{valid:false,reason:'angle',maxGrade,maxOrdinaryAngle,maxPassAngle};}
 }
 return{valid:true,maxGrade,maxOrdinaryAngle,maxPassAngle};
}
function stringPull(ctx,ps){
 let out=[ps[0]],i=0;while(i<ps.length-1){let best=i+1;for(let j=ps.length-1;j>i+1;j--){if(distance(ps[i],ps[j])>3)continue;if(trailSegmentAudit(ctx,ps[i],ps[j],.008,.003).valid){best=j;break;}}out.push(ps[best]);i=best;}return out;
}
function roundCorners(ctx,ps){
 if(ps.length<3)return ps;let out=[ps[0]];
 for(let i=1;i<ps.length-1;i++){let a=out.at(-1),b=ps[i],c=ps[i+1],ab=distance(a,b),bc=distance(b,c),rounded=false;
  for(let radius of[.16,.10,.06,.03,.012]){let r=Math.min(radius,ab*.35,bc*.35),p=mix(b,a,r/(ab||1)),q=mix(b,c,r/(bc||1)),arc=[],n=Math.max(6,Math.ceil(r*2/.008));for(let j=0;j<=n;j++){let t=j/n;arc.push([0,1].map(k=>(1-t)**2*p[k]+2*(1-t)*t*b[k]+t*t*q[k]));}let candidate=[a,...arc,c],ok=true;for(let j=1;j<candidate.length;j++)if(!trailSegmentAudit(ctx,candidate[j-1],candidate[j],.004,.001).valid){ok=false;break;}if(ok){out.push(...arc);rounded=true;break;}}
  if(!rounded)out.push(b);
 }out.push(ps.at(-1));return out;
}
function smoothNetwork(ctx,edges,targets){
 const pointKey=p=>p.map(v=>v.toFixed(7)).join(','),degree=new Map(),anchors=new Set(targets.map(t=>pointKey(t.point)));
 // Every branch join is a protected anchor. Smoothing a parent route must not
 // silently disconnect a branch that attaches to an interior vertex.
 for(let f of edges)for(let i=1;i<f.points.length;i++)for(let p of[f.points[i-1],f.points[i]])degree.set(pointKey(p),(degree.get(pointKey(p))||0)+1);
 for(let[k,d]of degree)if(d!==2)anchors.add(k);
 for(let f of edges){let ps=f.points,out=[ps[0]],start=0;for(let i=1;i<ps.length;i++)if(i===ps.length-1||anchors.has(pointKey(ps[i]))){let chunk=roundCorners(ctx,stringPull(ctx,ps.slice(start,i+1)));out.push(...chunk.slice(1));start=i;}f.points=out;f.stats=trailStats(ctx.field,out);f.stats.maxGrade=0;f.stats.maxOrdinaryContourAngle=0;f.stats.maxPassContourAngle=0;for(let j=1;j<out.length;j++){let a=trailSegmentAudit(ctx,out[j-1],out[j]);if(!a.valid)throw Error('平顺后的步道未通过地形约束：'+f.name);f.stats.maxGrade=Math.max(f.stats.maxGrade,a.maxGrade);f.stats.maxOrdinaryContourAngle=Math.max(f.stats.maxOrdinaryContourAngle,a.maxOrdinaryAngle);f.stats.maxPassContourAngle=Math.max(f.stats.maxPassContourAngle,a.maxPassAngle);}}
}
export function developTrails(doc,field){
 const ctx=hikingContext(doc,field),{nx,ny,N,point,key,water,heights}=ctx,targets=[];
 // Retain destination access points from the existing connected map where
 // possible, including small lakes and named vegetation regions.
 const prior=new Map((doc.trailNetwork?.targets||[]).map(t=>[t.id,t]));
 for(let f of doc.features){if(!(f.type==='village'||f.type==='lake'||f.type==='waterfall'||f.constraint==='saddle'||f.functionalArea||f.landscapeDestination))continue;
  let old=prior.get(f.id),desired=f.type==='waterfall'?f.points[1]:center(f),best=old&&!water[key(old.point)]?key(old.point):-1,bestScore=Infinity;
  if(best<0)for(let k=0;k<N;k++){if(water[k])continue;let p=point(k),d=distance(p,desired);if(f.type==='lake'){let shore=lakeDistance(p,f);if(shore<.07||shore>.30)continue;d=shore+distance(p,desired)*.03;}else if(['forest','grassland','meadow'].includes(f.type)){if(!inside(p,f.points)||f.holes?.some(h=>inside(p,h)))continue;}else if(d>.25)continue;let slope=Math.hypot(...terrainGradient(field,p)),score=d+slope*.12;if(score<bestScore){bestScore=score;best=k;}}
  if(best>=0)targets.push({id:f.id,name:f.name,kind:f.type,key:best,point:point(best),feature:f});
 }
 const root=targets.find(t=>t.id==='village-nw')||targets[0],cost=new Float64Array(N).fill(Infinity),parent=new Int32Array(N).fill(-1),heap=new Heap(),dirs=[];
 for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){if(!dx&&!dy)continue;let gcd=(a,b)=>b?gcd(b,a%b):a;if(gcd(Math.abs(dx),Math.abs(dy))===1)dirs.push([dx,dy,Math.hypot(dx,dy)*50]);}
 let cached=new Float32Array(N*dirs.length);
 const expand=()=>{while(heap.length){let[k,c]=heap.pop();if(c>cost[k]+1e-5)continue;let x=k%nx,y=Math.floor(k/nx),a=point(k);for(let z=0;z<dirs.length;z++){let[dx,dy,metres]=dirs[z],xx=x+dx,yy=y+dy;if(xx<0||xx>=nx||yy<0||yy>=ny)continue;let q=yy*nx+xx;if(water[q])continue;let edge=cached[k*dirs.length+z];if(!edge){let audit=trailSegmentAudit(ctx,a,point(q),.008,.003);if(!audit.valid)edge=Infinity;else{let grade=Math.abs(heights[q]-heights[k])/metres;edge=metres*(1+.3*(grade/.5)**2)+Math.abs(heights[q]-heights[k])*.12;}cached[k*dirs.length+z]=edge;}let cc=c+edge;if(cc<cost[q]){cost[q]=cc;parent[q]=k;heap.push(q,cc);}}}};
 cost[root.key]=0;heap.push(root.key,0);expand();
 let existing=new Set([root.key]),edges=[],records=[],remaining=targets.filter(t=>t!==root);root.feature.accessPoint=root.point;
 while(remaining.length){remaining.sort((a,b)=>cost[a.key]-cost[b.key]);let t=remaining.shift();if(!Number.isFinite(cost[t.key]))throw Error('登山步道无法连接 '+t.name+'; reachable='+cost.filter(Number.isFinite).length);let cells=[],k=t.key;while(k>=0&&!existing.has(k)){cells.push(k);k=parent[k];}if(k>=0)cells.push(k);for(let q of cells)existing.add(q);t.feature.accessPoint=t.point;
  if(cells.length<2){records.push({featureId:t.id,sharedNetwork:true});continue;}
  let f={id:'terrain-trail-'+edges.length,type:'trail',name:t.name+'支径',closed:false,points:cells.map(point),flowGeometry:'sampled',connectsTo:t.id,routeRole:t.feature.constraint==='saddle'?'pass-approach':'mountain-traverse'};edges.push(f);t.feature.accessibleVia=f.id;records.push({featureId:t.id,trailId:f.id});for(let q of cells){cost[q]=0;parent[q]=-1;heap.push(q,0);}expand();
 }
 smoothNetwork(ctx,edges,targets);
 let old=doc.features.filter(f=>f.type==='trail');for(let i=0;i<Math.min(old.length,edges.length);i++){let oldId=edges[i].id;edges[i].id=old[i].id;if(i<4)edges[i].name=old[i].name;for(let r of records)if(r.trailId===oldId)r.trailId=edges[i].id;for(let t of targets)if(t.feature.accessibleVia===oldId)t.feature.accessibleVia=edges[i].id;}
 doc.features=[...doc.features.filter(f=>f.type!=='trail'),...edges];doc.trailNetwork={version:2,root:root.id,spacingMetres:50,targetCount:targets.length,targets:targets.map(({id,name,kind,point})=>({id,name,kind,point})),links:records,routeMethod:'distance-led mountain trail tree; hard 50% grade, 45/60 degree contour angle; protected junctions, line-of-sight shortcuts and terrain-checked corner rounding',lengthKm:edges.reduce((s,f)=>s+f.stats.lengthKm,0),rules:{...HIKING_RULES},designStatus:'virtual mountain footpaths; terrain constraints use the current 50 m bilinear height field'};doc.hikingTrailsVersion=1;return doc.trailNetwork;
}
