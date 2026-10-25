import{clone,clamp,fieldFor,elevationAt,inside,distanceSegment,samplePath,contoursFrom,simplify}from'./model.js?v=6';
import{drainageAudit}from'./watersheds.js?v=3';
export const NX=401,NY=321,STEP=.05;
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export const center=f=>f.points.reduce((s,p)=>s.map((v,i)=>v+p[i]/f.points.length),[0,0]);
export class Heap{constructor(){this.a=[];}push(k,c){let a=this.a,i=a.length;a.push([k,c]);while(i){let p=(i-1)>>1;if(a[p][1]<=c)break;a[i]=a[p];i=p;}a[i]=[k,c];}pop(){let a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][1]<a[c][1])c++;if(a[c][1]>=last[1])break;a[i]=a[c];i=c;}a[i]=last;}return first;}get length(){return this.a.length;}}
export function lineSamples(points,step=.035){return samplePath({points,closed:false},step);}
export function profile(field,points,step=.008){let ps=lineSamples(points,step),hs=ps.map(p=>elevationAt(field,...p)),low=hs[0],rise=0;for(let h of hs){rise=Math.max(rise,h-low);low=Math.min(low,h);}return{start:hs[0],end:hs.at(-1),maxRise:rise,lengthKm:ps.slice(1).reduce((s,p,i)=>s+distance(ps[i],p),0)};}
export function maskPolygons(mask,nx,ny,step){
 let edges=[],byStart=new Map(),key=(x,y)=>y*(nx+1)+x;const add=(a,b)=>{let n=edges.length;edges.push([a,b]);let k=key(...a);if(!byStart.has(k))byStart.set(k,[]);byStart.get(k).push(n);};
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){let k=y*nx+x;if(!mask[k])continue;if(!y||!mask[k-nx])add([x,y],[x+1,y]);if(x===nx-1||!mask[k+1])add([x+1,y],[x+1,y+1]);if(y===ny-1||!mask[k+nx])add([x+1,y+1],[x,y+1]);if(!x||!mask[k-1])add([x,y+1],[x,y]);}
 let seen=new Uint8Array(edges.length),rings=[];for(let i=0;i<edges.length;i++){if(seen[i])continue;let points=[],q=i;while(q!==undefined&&!seen[q]){seen[q]=1;let[a,b]=edges[q];points.push(a.map(v=>v*step));q=(byStart.get(key(...b))||[]).find(v=>!seen[v]);}if(points.length<4)continue;let area=points.reduce((s,p,i)=>{let q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;rings.push({points,area});}return rings;
}
function resample(points,step=.12){let ps=[points[0]],carry=step;for(let i=1;i<points.length;i++){let a=points[i-1],b=points[i],n=distance(a,b);while(carry<n){ps.push(mix(a,b,carry/n));carry+=step;}carry-=n;}ps.push(points.at(-1));return ps;}
function curved(points,phase=0){let ps=resample(points,.09),smooth=ps.map(p=>[...p]);for(let pass=0;pass<3;pass++)smooth=smooth.map((p,i)=>i&&i<smooth.length-1?p.map((v,k)=>(smooth[i-1][k]+2*v+smooth[i+1][k])/4):p);return smooth.map((p,i)=>{if(!i||i===ps.length-1)return ps[i];let a=smooth[i-1],b=smooth[i+1],dx=b[0]-a[0],dy=b[1]-a[1],r=Math.hypot(dx,dy)||1,s=i*.09,env=Math.min(1,s/.35,(ps.length-i-1)*.09/.35),offset=(.045+.025*Math.sin(s*.65))*Math.sin(s*5.4+phase)*env;return[clamp(p[0]-dy/r*offset,0,20),clamp(p[1]+dx/r*offset,0,16)];});}
function localRoute(field,points){
 // Keep the full authored source/mouth and broad corridor; uphill crossings are
 // expensive, but allowed so local incision can retain an otherwise lost river.
 let anchors=resample(points,.8),out=[anchors[0]],values=field.values;
 for(let s=1;s<anchors.length;s++){let a=anchors[s-1],b=anchors[s],minX=Math.max(0,Math.floor((Math.min(a[0],b[0])-.55)*20)),maxX=Math.min(400,Math.ceil((Math.max(a[0],b[0])+.55)*20)),minY=Math.max(0,Math.floor((Math.min(a[1],b[1])-.55)*20)),maxY=Math.min(320,Math.ceil((Math.max(a[1],b[1])+.55)*20)),source=Math.round(a[1]*20)*NX+Math.round(a[0]*20),goal=Math.round(b[1]*20)*NX+Math.round(b[0]*20),cost=new Map([[source,0]]),parent=new Map(),heap=new Heap();heap.push(source,0);
  while(heap.length){let[k,c]=heap.pop();if(c!==cost.get(k))continue;if(k===goal)break;let x=k%NX,y=Math.floor(k/NX);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;let xx=x+dx,yy=y+dy;if(xx<minX||xx>maxX||yy<minY||yy>maxY)continue;let q=yy*NX+xx,near=distanceSegment([xx*.05,yy*.05],a,b),up=Math.max(0,values[q]-values[k]),cc=c+.05*Math.hypot(dx,dy)*(1+near*near*8)+up*.018+Math.max(0,values[q]-Math.max(elevationAt(field,...a),elevationAt(field,...b)))*.001;
   if(cc<(cost.get(q)??Infinity)){cost.set(q,cc);parent.set(q,k);heap.push(q,cc);}}
  }
  if(!parent.has(goal)&&goal!==source){out.push(b);continue;}let ps=[],k=goal;while(k!==source){ps.push([k%NX*.05,Math.floor(k/NX)*.05]);k=parent.get(k);if(k===undefined)break;}ps.reverse();out.push(...ps,b);
 }
 return out;
}
function shoreDistance(p,l){return inside(p,l.points)?0:Math.min(...l.points.map((q,i)=>distanceSegment(p,q,l.points[(i+1)%l.points.length])));}
function chooseFall(doc,field,riverId,lakeId,drop,id,name){
 let r=doc.features.find(f=>f.id===riverId),lake=doc.features.find(f=>f.id===lakeId),start=r.points[0],best=null,score=Infinity;
 for(let j=Math.max(0,Math.floor((start[1]-.3)*20));j<=Math.min(320,Math.ceil((start[1]+.3)*20));j++)for(let i=Math.max(0,Math.floor((start[0]-.3)*20));i<=Math.min(400,Math.ceil((start[0]+.3)*20));i++){let lip=[i*.05,j*.05];if(!inside(lip,lake.points))continue;for(let[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){let toe=[(i+dx)*.05,(j+dy)*.05];if(toe[0]<0||toe[0]>20||toe[1]<0||toe[1]>16||inside(toe,lake.points))continue;if(lakeId==='lake-north'&&dy>=0)continue;if(lakeId==='lake-south'&&(dx<0||dy<0))continue;let c=distance(lip,start)+distance(toe,r.points[Math.min(2,r.points.length-1)])*.2;if(c<score){score=c;best={lip,toe};}}}
 if(!best)throw Error('瀑布的湖岸位置未找到。');
 let outward=best.toe.map((v,i)=>(v-best.lip[i])/.05),lead=best.toe.map((v,i)=>v+outward[i]*.15),join=r.points.findIndex(p=>distance(p,best.lip)>.28&&(p[0]-best.toe[0])*outward[0]+(p[1]-best.toe[1])*outward[1]>.12);r.points=[best.lip,best.toe,lead,...r.points.slice(Math.max(1,join))];
 let f={id,type:'waterfall',name,closed:false,points:[best.lip,best.toe],elevation:lake.elevation,drop,riverId,lakeId,lowerElevation:lake.elevation-drop,form:'bedrock-lip-plunge-pool',widthMetres:riverId==='river-north'?34:27};f.terrainBaked=true;f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;f.baselineDrop=f.drop;doc.features.push(f);return f;
}
function carve(doc,field){
 const before=Array.from(field.values),lakes=doc.features.filter(f=>f.type==='lake'),falls=doc.features.filter(f=>f.type==='waterfall'),rivers=doc.features.filter(f=>f.type==='river'),values=Array.from(before),water=new Int16Array(values.length).fill(-1);
 for(let l=0;l<lakes.length;l++){let lake=lakes[l],xs=lake.points.map(p=>p[0]),ys=lake.points.map(p=>p[1]);for(let j=Math.max(0,Math.floor(Math.min(...ys)*20)-1);j<=Math.min(320,Math.ceil(Math.max(...ys)*20)+1);j++)for(let i=Math.max(0,Math.floor(Math.min(...xs)*20)-1);i<=Math.min(400,Math.ceil(Math.max(...xs)*20)+1);i++)if(inside([i*.05,j*.05],lake.points)){water[j*NX+i]=l;values[j*NX+i]=lake.elevation;}}
 let lines=[];
 for(let r of rivers){let points=lineSamples(r.points,.018),fall=falls.find(f=>f.riverId===r.id),heights=[],low=elevationAt(field,...points[0]),endLake=lakes.find(l=>shoreDistance(points.at(-1),l)<.1),minimum=endLake?.elevation??-Infinity,total=0;
  for(let i=0;i<points.length;i++){let p=points[i];if(i)total+=distance(points[i-1],p);let h=elevationAt(field,...p);if(i===0){let l=lakes.find(l=>shoreDistance(p,l)<.12);if(l)low=l.elevation;}
   if(fall){let d=distance(p,fall.points[0]);if(d<.005)h=fall.elevation;else if(total>=distance(...fall.points)-.004)h=Math.min(h,fall.lowerElevation);}
   low=Math.max(minimum,Math.min(low,h));heights.push(low);
  }
  // Remove storage plateaus with a tiny downhill grade where the next fixed
  // lake level leaves room; these are not wholesale valley-height changes.
  for(let i=heights.length-2;i>=0;i--)heights[i]=Math.max(heights[i],Math.min(heights[i]+.025,heights[i+1]+.04));
  lines.push({r,points,heights});
 }
 for(let line of lines)for(let n=1;n<line.points.length;n++){let a=line.points[n-1],b=line.points[n],ha=line.heights[n-1],hb=line.heights[n],minX=Math.max(0,Math.floor((Math.min(a[0],b[0])-.20)*20)),maxX=Math.min(400,Math.ceil((Math.max(a[0],b[0])+.20)*20)),minY=Math.max(0,Math.floor((Math.min(a[1],b[1])-.20)*20)),maxY=Math.min(320,Math.ceil((Math.max(a[1],b[1])+.20)*20));
  for(let j=minY;j<=maxY;j++)for(let i=minX;i<=maxX;i++){let k=j*NX+i;if(water[k]>=0)continue;let x=i*.05,y=j*.05,dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1),d=distance([x,y],mix(a,b,t));if(d>.20)continue;let bed=ha+(hb-ha)*t,section=4200*d*d+180*d;values[k]=Math.min(values[k],bed+section);}
 }
 for(let fall of falls){let r=rivers.find(r=>r.id===fall.riverId),low=fall.lowerElevation,previous=fall.points[1].map(v=>Math.round(v*20));for(let p of lineSamples(r.points.slice(1),.012)){let next=p.map(v=>Math.round(v*20));while(previous[0]!==next[0]||previous[1]!==next[1]){let axis=Math.abs(next[0]-previous[0])>=Math.abs(next[1]-previous[1])?0:1;previous[axis]+=Math.sign(next[axis]-previous[axis]);let k=previous[1]*NX+previous[0];if(water[k]<0){low=Math.min(low,values[k]);values[k]=low;}}if(low<fall.lowerElevation-15)break;}}
 let working={nx:NX,ny:NY,values};
 const pin=(p,h)=>{let fx=p[0]*20,fy=p[1]*20;for(let j of[Math.floor(fy),Math.ceil(fy)])for(let i of[Math.floor(fx),Math.ceil(fx)]){let k=j*NX+i;if(water[k]<0)values[k]=Math.min(values[k],h);}};
 for(let pass=0;pass<12;pass++){for(let line of lines){let low=elevationAt(working,...line.points[0]);for(let i=1;i<line.points.length;i++){let p=line.points[i],h=elevationAt(working,...p);if(h>low+.03)pin(p,low-.015);low=Math.min(low,elevationAt(working,...p));}}
  for(let fall of falls){let a=fall.points[0],b=fall.points[1];values[Math.round(a[1]*20)*NX+Math.round(a[0]*20)]=fall.elevation;values[Math.round(b[1]*20)*NX+Math.round(b[0]*20)]=fall.lowerElevation;}
 }
 return working;
}
export function developHydrology(doc){
 let field=fieldFor(doc.features,NX,NY,500,doc.terrainBase),rivers=doc.features.filter(f=>f.type==='river'),before=clone(rivers),reports=[];
 for(let i=0;i<rivers.length;i++){let r=rivers[i],original=clone(r.points),p=profile(field,original),route=p.maxRise>35?localRoute(field,original):original;r.points=curved(route,i*1.4);r.flowDirection='points-order';r.flowGeometry='sampled';r.hydrology={preserveFullCourse:true,originalSource:original[0],originalMouth:original.at(-1)};reports.push({id:r.id,name:r.name,before:p});}
 chooseFall(doc,field,'river-north','lake-north',106,'falls-yingxue','听雪瀑');chooseFall(doc,field,'river-south','lake-south',85,'falls-cangyue','藏月瀑');
 field=carve(doc,field);
 return{field,reports,before};
}
export function settleBasins(doc,field){
 let audit=drainageAudit(field),mask=new Uint8Array(NX*NY),visited=new Uint8Array(NX*NY),groups=[];
 for(let k=0;k<mask.length;k++)mask[k]=audit.spill[k]-field.values[k]>.18?1:0;
 for(let seed=0;seed<mask.length;seed++){if(!mask[seed]||visited[seed])continue;let cells=[seed];visited[seed]=1;for(let n=0;n<cells.length;n++){let k=cells[n],x=k%NX,y=Math.floor(k/NX);for(let q of[x?k-1:-1,x<400?k+1:-1,y?k-NX:-1,y<320?k+NX:-1])if(q>=0&&mask[q]&&!visited[q]){visited[q]=1;cells.push(q);}}let depth=Math.max(...cells.map(k=>audit.spill[k]-field.values[k]));if(cells.length<5||depth<1){for(let k of cells)field.values[k]=audit.spill[k];continue;}groups.push(cells);}
 let names=['云镜湖','松露潭','抱岚湖','星落潭','凝碧湖','照影潭','白露湖','青萝潭','含烟潭','枕霞潭','洗尘潭','见月潭','濯星潭','流萤潭','晴漪潭'],lakes=doc.features.filter(f=>f.type==='lake'),added=0;
 for(let cells of groups){let level=Math.max(...cells.map(k=>audit.spill[k])),cellMask=new Uint8Array(400*320),insideOriginal=lakes.filter(l=>cells.some(k=>inside([k%NX*.05,Math.floor(k/NX)*.05],l.points))),owner=insideOriginal[0];
  // Fill the actual depression to its spill surface, explicitly retaining the
  // water mask and shore as a lake, rather than leaving an invisible filled pit.
  for(let k of cells){field.values[k]=audit.spill[k];let x=k%NX,y=Math.floor(k/NX);for(let dy of[-1,0])for(let dx of[-1,0])if(x+dx>=0&&x+dx<400&&y+dy>=0&&y+dy<320)cellMask[(y+dy)*400+x+dx]=1;}
  if(owner){for(let y=0;y<320;y++)for(let x=0;x<400;x++)if(inside([(x+.5)*.05,(y+.5)*.05],owner.points))cellMask[y*400+x]=1;}
  let rings=maskPolygons(cellMask,400,320,.05).filter(r=>r.area>0).sort((a,b)=>b.area-a.area);if(!rings.length)continue;
  if(owner){owner.points=simplify([...rings[0].points,rings[0].points[0]],.018).slice(0,-1);owner.elevation=level;owner.basinLake=true;}
  else{let f={id:'basin-lake-'+added,type:'lake',name:names[added%names.length]+(added>=names.length?'·'+(added+1):''),closed:true,points:simplify([...rings[0].points,rings[0].points[0]],.018).slice(0,-1),elevation:level,basinLake:true,hideLabel:rings[0].area<.16};doc.features.push(f);lakes.push(f);added++;}
 }
 return{field,groups:groups.length,added};
}
export function storeTerrain(doc,field){let contours=contoursFrom(field,doc.contourInterval||200,.012);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];doc.terrainBase={nx:NX,ny:NY,values:Array.from(field.values)};}
export function finalizeWater(doc,field){
 // Bake newly resolved lake surfaces and their raster shoreline. Avoid making
 // an artificial ringing trench by repeatedly solving those fixed shores.
 let lakes=doc.features.filter(f=>f.type==='lake');field=fieldFor(doc.features.filter(f=>f.type!=='contour').map(f=>f.type==='waterfall'?{...f,terrainBaked:false}:f),NX,NY,400,field);for(let fall of doc.features.filter(f=>f.type==='waterfall')){let r=doc.features.find(r=>r.id===fall.riverId),previous=fall.points[1].map(v=>Math.round(v*20)),low=fall.lowerElevation;field.values[previous[1]*NX+previous[0]]=low;for(let p of lineSamples(r.points.slice(1),.01)){let next=p.map(v=>Math.round(v*20));while(previous[0]!==next[0]||previous[1]!==next[1]){let axis=Math.abs(next[0]-previous[0])>=Math.abs(next[1]-previous[1])?0:1;previous[axis]+=Math.sign(next[axis]-previous[axis]);let q=[previous[0]*.05,previous[1]*.05],k=previous[1]*NX+previous[0];if(!lakes.some(l=>inside(q,l.points))){low=Math.min(low,field.values[k]);field.values[k]=low;}}if(low<fall.lowerElevation-15)break;}}let flood=drainageAudit(field);field.values=Array.from(flood.spill);
 for(let l of lakes){l.terrainBaked=true;l.baselinePoints=clone(l.points);l.baselineElevation=l.elevation;}
 // Downhill interpolation audit includes all reaches. Lower only their small
 // supporting cells; global priority flood then removes numerical micro-sinks.
 let water=new Uint8Array(NX*NY);for(let j=0;j<NY;j++)for(let i=0;i<NX;i++)if(lakes.some(l=>inside([i*.05,j*.05],l.points)))water[j*NX+i]=1;
 for(let pass=0;pass<8;pass++){
  for(let r of doc.features.filter(f=>f.type==='river')){let ps=lineSamples(r.points,.006),low=elevationAt(field,...ps[0]);for(let p of ps.slice(1)){let h=elevationAt(field,...p);if(h>low+.045){let fx=p[0]*20,fy=p[1]*20;for(let y of[Math.floor(fy),Math.ceil(fy)])for(let x of[Math.floor(fx),Math.ceil(fx)]){let k=y*NX+x;if(!water[k])field.values[k]=Math.min(field.values[k],low-.02);}}low=Math.min(low,elevationAt(field,...p));}}
  let a=drainageAudit(field);for(let k=0;k<field.values.length;k++)if(a.spill[k]-field.values[k]>.03)field.values[k]=a.spill[k];
 }
 return field;
}
