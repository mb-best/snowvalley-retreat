import{clone,clamp,fieldFor,elevationAt,samplePath,inside,distanceSegment}from'./model.js?v=5';
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const length=ps=>ps.slice(1).reduce((s,p,i)=>s+dist(ps[i],p),0);
const centre=f=>f.points.reduce((s,p)=>s.map((v,i)=>v+p[i]/f.points.length),[0,0]);
const lakeDistance=(p,l)=>inside(p,l.points)?0:Math.min(...l.points.map((a,i)=>distanceSegment(p,a,l.points[(i+1)%l.points.length])));
export function riverProfile(field,points,step=.008){let samples=samplePath({points,closed:false},step),hs=samples.map(p=>elevationAt(field,...p)),low=hs[0],rise=0,totalRise=0;for(let i=1;i<hs.length;i++){rise=Math.max(rise,hs[i]-low);low=Math.min(low,hs[i]);totalRise+=Math.max(0,hs[i]-hs[i-1]);}return{start:hs[0],end:hs.at(-1),maxRise:rise,totalRise,lengthKm:length(points)};}
function downhill(field,a,b,tolerance=.06){let n=Math.max(2,Math.ceil(dist(a,b)/.008)),low=elevationAt(field,...a);for(let i=1;i<=n;i++){let h=elevationAt(field,...mix(a,b,i/n));if(h-low>tolerance)return false;low=Math.min(low,h);}return true;}
function resample(points,step=.10){let ps=[points[0]],carry=step;for(let i=1;i<points.length;i++){let a=points[i-1],b=points[i],n=dist(a,b);while(carry<n){ps.push(mix(a,b,carry/n));carry+=step;}carry-=n;}if(dist(ps.at(-1),points.at(-1))>.001)ps.push(points.at(-1));return ps;}
function projectHeight(field,q,height,anchor){
 let p=[...q];for(let n=0;n<10;n++){let h=elevationAt(field,...p),error=h-height;if(Math.abs(error)<.003)break;let gx=(elevationAt(field,p[0]+.004,p[1])-elevationAt(field,p[0]-.004,p[1]))/.008,gy=(elevationAt(field,p[0],p[1]+.004)-elevationAt(field,p[0],p[1]-.004))/.008,g=gx*gx+gy*gy;if(g<.01)return null;let amount=error/g,scale=Math.min(1,.025/(Math.hypot(gx*amount,gy*amount)||1));p=[clamp(p[0]-gx*amount*scale,0,20),clamp(p[1]-gy*amount*scale,0,16)];if(dist(p,anchor)>.25)return null;}return p;
}
function roundDownhill(field,points){
 let ps=points.map(p=>[...p]);
 // Slide corners along the actual elevation surface, rather than drawing a
 // cosmetic spline which may climb an unseen bank between its control points.
 for(let pass=0;pass<5;pass++)for(let i=1;i<ps.length-1;i++){let target=elevationAt(field,...ps[i]),candidate=ps[i].map((v,k)=>v*.50+(ps[i-1][k]+ps[i+1][k])*.25),q=projectHeight(field,candidate,target,ps[i]);if(q&&downhill(field,ps[i-1],q,.008)&&downhill(field,q,ps[i+1],.008))ps[i]=q;}
 return ps;
}
function route(field,start,target,guide,phase){
 const{nx,ny,values}=field,N=nx*ny,step=20/(nx-1),point=k=>[k%nx*step,Math.floor(k/nx)*step],key=p=>Math.round(p[1]/step)*nx+Math.round(p[0]/step),source=key(start),cost=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),done=new Uint8Array(N),heap=[];
 let guidePoints=resample(guide,.15),buckets=new Map();for(let i=1;i<guidePoints.length;i++){let a=guidePoints[i-1],b=guidePoints[i],dx=b[0]-a[0],dy=b[1]-a[1],r=Math.hypot(dx,dy)||1,s=i*.15,offset=(.10+.055*Math.sin(s*.73+phase))*Math.sin(s*5.2+phase)*Math.min(1,s/.6,(guidePoints.length*.15-s)/.6),p=[b[0]-dy/r*offset,b[1]+dx/r*offset];let k=Math.floor(p[0])+'|'+Math.floor(p[1]);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(p);}
 const guideDistance=(x,y)=>{let bx=Math.floor(x),by=Math.floor(y),best=9;for(let yy=by-1;yy<=by+1;yy++)for(let xx=bx-1;xx<=bx+1;xx++)for(let p of buckets.get(xx+'|'+yy)||[])best=Math.min(best,(x-p[0])**2+(y-p[1])**2);return best;};
 const push=(k,c)=>{let i=heap.length;heap.push([k,c]);while(i){let p=(i-1)>>1;if(heap[p][1]<=c)break;heap[i]=heap[p];i=p;}heap[i]=[k,c];};
 const pop=()=>{let first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 cost[source]=0;push(source,0);let reached=-1,bestExit=-1,bestExitScore=Infinity;
 while(heap.length){let[k,c]=pop();if(done[k])continue;done[k]=1;let p=point(k),x=k%nx,y=Math.floor(k/nx);
  if(target.lake&&inside(p,target.lake.points)){reached=k;break;}
  if(!x||!y||x===nx-1||y===ny-1){let score=c+dist(p,target.point)*8;if(score<bestExitScore){bestExitScore=score;bestExit=k;}if(!target.lake&&dist(p,target.point)<.12){reached=k;break;}}
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy;if(xx<0||xx>=nx||yy<0||yy>=ny)continue;let q=yy*nx+xx;if(done[q]||values[q]>values[k]+.025)continue;let pp=point(q);if(dx&&dy&&!downhill(field,p,pp,.04))continue;
   let g=guideDistance(...pp),travel=step*Math.hypot(dx,dy)*(1+g*60),cc=c+travel;if(cc<cost[q]){cost[q]=cc;prev[q]=k;push(q,cc);}
  }
 }
 if(reached<0)reached=bestExit;
 if(reached<0)throw Error('河道在当前地势中没有下泄通道，已保留原草案。');
 let ps=[],k=reached;while(k>=0){ps.push(point(k));if(k===source)break;k=prev[k];}ps.reverse();
 if(ps.length<3)throw Error('河道过短，未覆盖当前草案。');
 // Adaptive bank-to-bank bends: accept only offsets with a downhill profile.
 let rounded=roundDownhill(field,ps),dense=resample(rounded,.075);
 for(let pass=0;pass<2;pass++)for(let i=1;i<dense.length-1;i++){let a=dense[i-1],b=dense[i+1],dx=b[0]-a[0],dy=b[1]-a[1],r=Math.hypot(dx,dy)||1,s=i*.075,envelope=Math.min(1,s/.4,(dense.length-1-i)*.075/.4),offset=.14*Math.sin(s*5.2+phase)*envelope;
  for(let scale of[1,.5,.25]){let candidate=[clamp(dense[i][0]-dy/r*offset*scale,0,20),clamp(dense[i][1]+dx/r*offset*scale,0,16)],q=projectHeight(field,candidate,elevationAt(field,...dense[i]),dense[i]);if(q&&downhill(field,a,q,.025)&&downhill(field,q,b,.025)){dense[i]=q;break;}}
 }
 dense=roundDownhill(field,dense);
 // Each accepted segment is independently non-increasing, then audit the entire
 // reach to catch cumulative numerical rises and preserve the checked polyline.
 if(riverProfile(field,dense,.002).maxRise>.09)dense=riverProfile(field,rounded,.002).maxRise<.09?rounded:ps;
 return{points:dense,reachedLake:!!target.lake&&inside(point(reached),target.lake.points),targetChanged:dist(point(reached),target.point)>.15};
}
function addLodge(doc,field){
 if(doc.features.some(f=>f.id==='estate-guiyun'))return;
 let lake=doc.features.find(f=>f.id==='lake-south'),valley=doc.features.find(f=>f.id==='valley-south');if(!lake)return;
 let c=centre(lake),best=null,bestScore=Infinity;
 for(let y=c[1]-.4;y<c[1]+1;y+=.05)for(let x=c[0]-1.1;x<c[0]-.35;x+=.05){let p=[x,y],d=lakeDistance(p,lake);if(d<.16||d>.5||valley&&!inside(p,valley.points))continue;let h=elevationAt(field,x,y),slope=Math.hypot(elevationAt(field,x+.05,y)-elevationAt(field,x-.05,y),elevationAt(field,x,y+.05)-elevationAt(field,x,y-.05))/100;if(h<lake.elevation+12||h>lake.elevation+160)continue;let score=slope*8+Math.abs(d-.24)*2+Math.abs(h-lake.elevation-60)/200;if(score<bestScore){bestScore=score;best={p,h};}}
 if(!best)best={p:[c[0]-.75,c[1]+.3],h:elevationAt(field,c[0]-.75,c[1]+.3)};
 doc.features.push({id:'estate-guiyun',type:'village',placeKind:'lodge',name:'栖月山庄',points:[best.p],closed:false,elevation:Math.round(best.h),terrainConstraint:'none',description:'归云谷内、藏月湖西侧的岸边山庄。'});
}
export function refineRivers(doc){
 if(doc.riverRefinementVersion>=2)return false;
 let field=fieldFor(doc.features,401,321,500,doc.terrainBase),lakes=doc.features.filter(f=>f.type==='lake'),rivers=doc.features.filter(f=>f.type==='river'),report=[];
 for(let i=0;i<rivers.length;i++){let f=rivers[i],old=clone(f.points),before=riverProfile(field,old),start=old[0],end=old.at(-1),endLake=lakes.find(l=>lakeDistance(end,l)<.12),startLake=lakes.find(l=>lakeDistance(start,l)<.15);
  // A hand-drawn stream which starts below its destination lake cannot climb
  // the intervening divide. Its highest intended headwater becomes the source.
  let sourceAdjusted=false;if(endLake&&!startLake&&before.maxRise>30){let samples=samplePath(f,.04),highest=samples.reduce((a,p)=>elevationAt(field,...p)>elevationAt(field,...a)?p:a,start);start=highest;old=[start,...old.slice(old.reduce((best,p,j)=>dist(p,start)<dist(old[best],start)?j:best,0)+1)];sourceAdjusted=true;}
  if(!endLake&&before.start<before.end){old.reverse();start=old[0];end=old.at(-1);}
  let target={point:end,lake:endLake},result=route(field,start,target,old,i*1.71);
  if(startLake){let firstOutside=result.points.findIndex(p=>!inside(p,startLake.points));if(firstOutside>0)result.points=result.points.slice(firstOutside-1);}
  f.points=result.points;f.closed=false;f.flowDirection='points-order';f.flowGeometry='sampled';f.hydrology={sourceAdjusted,reachedIntendedLake:result.reachedLake};
  report.push({id:f.id,name:f.name,before,after:riverProfile(field,f.points),sourceAdjusted,targetChanged:result.targetChanged,reachedIntendedLake:result.reachedLake});
 }
 // Where a corrected tributary reaches an existing stream, share the
 // downstream channel instead of drawing two nearly parallel outlet lines.
 for(let item of report.filter(r=>r.targetChanged)){let f=rivers.find(f=>f.id===item.id),walk=0,joined=false;for(let i=1;i<f.points.length&&!joined;i++){walk+=dist(f.points[i-1],f.points[i]);if(walk<.35)continue;let p=f.points[i];for(let other of rivers.filter(g=>g.id!==f.id&&!report.find(r=>r.id===g.id)?.targetChanged)){for(let j=1;j<other.points.length;j++){let a=other.points[j-1],b=other.points[j],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1),q=mix(a,b,t);if(dist(p,q)>.075||!downhill(field,f.points[i-1],q,.02))continue;let proposal=[...f.points.slice(0,i),q];if(riverProfile(field,proposal).maxRise>.1)continue;f.points=proposal;f.hydrology.joinsRiver=other.id;item.after=riverProfile(field,f.points);item.joinsRiver=other.id;joined=true;break;}if(joined)break;}}}
 addLodge(doc,field);doc.riverRefinementVersion=2;doc.terrainDesign={...doc.terrainDesign,rivers:{version:2,gridMetres:50,terrainChanged:false,report}};doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();return true;
}
