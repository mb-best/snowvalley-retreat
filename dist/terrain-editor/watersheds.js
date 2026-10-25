import{clone,clamp,fieldFor,elevationAt,contoursFrom,inside,distanceSegment,simplify}from'./model.js?v=4';

// An authored alpine watershed, not a copy of measured terrain. References and
// the drainage assumptions are documented in docs/TERRAIN-EDITOR.md.
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const centre=f=>f.points.reduce((s,p)=>s.map((v,i)=>v+p[i]/f.points.length),[0,0]);
function curve(points,step=.09){
 let out=[];for(let i=0;i<points.length-1;i++){let a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)],n=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/step));for(let j=0;j<n;j++){let t=j/n;out.push([0,1].map(k=>clamp(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t),0,k?16:20)));}}out.push([...points.at(-1)]);return out;
}
function path(points,heights=null){
 let lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 return{points,lengths,length:lengths.at(-1),heights,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
}
function nearest(line,x,y){
 let best=Infinity,along=0,side=0,index=1,part=0;
 for(let i=1;i<line.points.length;i++){let a=line.points[i-1],b=line.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1),u=x-a[0]-dx*t,v=y-a[1]-dy*t,d2=u*u+v*v;if(d2<best){best=d2;along=mix(line.lengths[i-1],line.lengths[i],t);side=Math.sign(dx*v-dy*u);index=i;part=t;}}
 return{d:Math.sqrt(best),s:along,side,index,part};
}
function ridge(a,b,passName,height,bend){
 let start=a.points[0],end=b.points[0],pass=lerp(start,end,.5).map((v,i)=>v+bend[i]);
 let line=path(curve([start,lerp(start,pass,.48),pass,lerp(pass,end,.52),end]));
 let passS=nearest(line,...pass).s;return{...line,a,b,pass,passS,passName,height:Math.min(height,a.elevation-300,b.elevation-300)};
}
function crest(l,s){let first=s<=l.passS,t=first?s/l.passS:(l.length-s)/(l.length-l.passS),h=first?l.a.elevation:l.b.elevation;return mix(l.height,h,(1-t)**1.4)+65*Math.sin(t*Math.PI*2)**2;}
function outlet(lake,waypoints,endHeight,name,id){
 let start=centre(lake),line=path(curve([start,...waypoints]));return{...line,startHeight:lake.elevation,endHeight,lakeId:lake.id,name,id};
}
function headValley(points,from,to){return{...path(curve(points)),startHeight:from,endHeight:to};}
function lineFloor(l,n){return l.heights?mix(l.heights[n.index-1],l.heights[n.index],n.part):mix(l.startHeight,l.endHeight,clamp((n.s-(l.shoreS||0))/(l.length-(l.shoreS||0)),0,1));}

// Priority flood on the complete heightfield: the spill surface and each cell's
// predecessor give an independent check for unintended internal depressions.
export function drainageAudit(field){
 const{nx,ny,values}=field,N=nx*ny,spill=new Float64Array(N),parent=new Int32Array(N).fill(-1),seen=new Uint8Array(N),heap=[];
 const push=(k,h)=>{let i=heap.length;heap.push([k,h]);while(i){let p=(i-1)>>1;if(heap[p][1]<=h)break;heap[i]=heap[p];i=p;}heap[i]=[k,h];};
 const pop=()=>{let first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
 const seed=k=>{if(seen[k])return;seen[k]=1;spill[k]=values[k];push(k,values[k]);};
 for(let i=0;i<nx;i++){seed(i);seed((ny-1)*nx+i);}for(let j=1;j<ny-1;j++){seed(j*nx);seed(j*nx+nx-1);}
 while(heap.length){let[k,h]=pop(),x=k%nx,y=Math.floor(k/nx);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy;if((!dx&&!dy)||(dx&&dy)||xx<0||xx>=nx||yy<0||yy>=ny)continue;let q=yy*nx+xx;if(seen[q])continue;seen[q]=1;parent[q]=k;spill[q]=Math.max(h,values[q]);push(q,spill[q]);}}
 let maxDepth=0,volume=0,cells=0;for(let k=0;k<N;k++){let d=spill[k]-values[k];if(d>.11){maxDepth=Math.max(maxDepth,d);volume+=d;cells++;}}
 return{spill,parent,maxDepth,cells,pondedAreaKm2:cells*20/(nx-1)*16/(ny-1),volumeKm3:volume*20/(nx-1)*16/(ny-1)/1000};
}
function condition(field){
 let audit=drainageAudit(field); // Small interpolation/rock-surface hollows fill to their outlet.
 for(let k=0;k<field.values.length;k++)field.values[k]=Math.round(audit.spill[k]*10)/10;
 return{maxCorrectionMeters:Math.round(audit.maxDepth),correctedAreaKm2:Math.round(audit.pondedAreaKm2*100)/100};
}
export function redesignWatersheds(doc){
 if(doc.watershedShapeVersion>=2)return false;
 let peaks=Object.fromEntries(doc.features.filter(f=>f.type==='peak').map(f=>[f.id,f]));
 let specs=[['north-peak','main-peak','雪隐垭口',5360,[.18,-.18]],['main-peak','south-peak','归云垭口',5080,[-.12,.15]],['west-peak','main-peak','听雪垭口',5280,[0,.80]],['west-peak','sw-peak','松风垭口',5020,[-.15,0]],['main-peak','east-peak','云桥垭口',5120,[.08,.05]]];
 let links=specs.filter(([a,b])=>peaks[a]&&peaks[b]).map(([a,b,n,h,o])=>ridge(peaks[a],peaks[b],n,h,o));if(!links.length)return false;
 // Five edges for six peaks: no closed ridge loops. Two old closure passes and
 // their ridge segments are intentionally removed, opening the valley outlets.
 doc.features=doc.features.filter(f=>f.type!=='contour'&&f.type!=='ridge'&&f.constraint!=='saddle');
 let axes=[['ridge-main','雪隐脊',[0,1]],['ridge-west','听雪岭',[2]],['ridge-sw','栖霞岭',[3]],['ridge-link','云桥脊',[4]]];
 for(let[id,name,indices]of axes){let pieces=indices.map(i=>links[i]).filter(Boolean);if(!pieces.length)continue;let points=simplify(pieces.flatMap((l,i)=>i?l.points.slice(1):l.points),.025);doc.features.push({id,type:'ridge',name,points,closed:false,terrainRole:'crest',baselinePoints:clone(points),baselineElevation:0});}
 for(let l of links)doc.features.push({id:'pass-'+l.a.id+'-'+l.b.id,type:'label',constraint:'saddle',name:l.passName,points:[l.pass],closed:false,elevation:l.height});
 let lakes=doc.features.filter(f=>f.type==='lake'),villages=doc.features.filter(f=>f.type==='village'),valleys=[];
 for(let lake of lakes){let[x,y]=centre(lake),out;
  if(lake.id==='lake-north')out=outlet(lake,[[x-.05,y-.8],[6.8,5.7],[7.35,4.2],[6.5,2.5],[5.8,0]],2200,'松影河','river-north');
  else if(lake.id==='lake-east')out=outlet(lake,[[x+.7,y-.45],[14.0,3.6],[16.4,2.4],[18.4,0]],2350,'眠风溪',doc.features.some(f=>f.id==='river-east')?'river-east':'drain-east-lake');
  else if(lake.id==='lake-south')out=outlet(lake,[[x+.4,y+.65],[14.4,14.0],[16.0,14.9],[18.2,14.0],[18.5,11.4],[20,10.6]],1820,'清音溪','river-south');
  else if(x<8&&y>10)out=outlet(lake,[[x+.1,y+.65],[5.9,14.6],[5.5,16]],2850,'月汀溪','drain-moon-lake');
  else{let distances=[x,20-x,y,16-y],side=distances.indexOf(Math.min(...distances)),end=[[0,y],[20,y],[x,0],[x,16]][side];out=outlet(lake,[lerp([x,y],end,.5),end],Math.max(1800,lake.elevation-650),'出湖溪流','drain-'+lake.id);}
  out.shoreS=out.points.reduce((s,p,i)=>inside(p,lake.points)?out.lengths[i]:s,0);valleys.push(out);
 }
 // Open glacial troughs beside the main divide and small tributary gullies.
 valleys.push(headValley([[10.6,7.9],[11.5,6.5],[12.1,5.6],[13.5,4.4],[15.2,3.0],[17.5,0]],4510,2400));
 valleys.push(headValley([[10.8,11.2],[11.1,12.4],[12.2,13.7],[14.4,14.0]],4050,2950));
 valleys.push(headValley([[1.9,7.7],[1.25,9.0],[.45,10.7],[0,12.0]],4200,2400));
 for(let v of villages){let[x,y]=v.points[0],ds=[x,20-x,y,16-y],side=ds.indexOf(Math.min(...ds)),end=[[0,y],[20,y],[x,0],[x,16]][side];valleys.push(headValley([[x,y],lerp([x,y],end,.5),end],v.elevation,Math.max(1750,v.elevation-250)));}
 // The user's east-side stream already follows this flank; cut its valley too.
 let eastStream=doc.features.find(f=>f.type==='river'&&f.name==='漱石溪');
 if(eastStream){let points=clone(eastStream.points),a=points[0],b=points.at(-1);if(a[1]<b[1])points.reverse();valleys.push(headValley(points,3900,2380));}
 // Fresh regional bedrock surface. Reusing the previous raised grid would leave
 // the old ring dams and knife edges embedded beneath the new contour drawing.
 let field={nx:401,ny:321,values:new Array(401*321)};
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){
  let x=i*.05,y=j*.05,h=2420+150*Math.sin(x*.22+y*.16)+130*Math.cos(y*.31)+360*Math.exp(-((x-16.5)**2/25+(y-1.8)**2/13))+1450*Math.exp(-((x-12.8)**2/13+(y-12.6)**2/10));
  for(let l of links){if(x<l.minX-4||x>l.maxX+4||y<l.minY-4||y>l.maxY+4)continue;let n=nearest(l,x,y),d=n.d*(1+.12*n.side*Math.sin(n.s*.7)),top=crest(l,n.s),shoulder=.32+.10*Math.sin(n.s*.85),drop=790*(Math.sqrt(d*d+shoulder*shoulder)-shoulder)+125*d*d;
   // Wide convex ridge shoulders, then steeper flanks. Only the summit caps
   // retain short rock faces; the entire divide is not an infinitely thin blade.
   let gullies=(110+210*smooth(d/2))*Math.sin(n.s*3.5+d*.9+n.side*.6)**8*smooth(d/.45)*smooth((4.2-d)/1.0),surface=top-drop-gullies;
   h=Math.max(h,surface);
  }
  // Directional rock ribs, small relative to the mountain mass; no radial cones.
  let relief=(26*Math.sin(x*4.7+y*2.2)*Math.sin(y*3.2-x*.8)+12*Math.sin(x*9-y*6))*smooth((h-3300)/1700);
  h+=relief;
  // Shelves around the retained lake outlines and settlements, with smooth banks.
  for(let lake of lakes){let d=inside([x,y],lake.points)?0:Infinity;if(d)for(let p=0;p<lake.points.length;p++)d=Math.min(d,distanceSegment([x,y],lake.points[p],lake.points[(p+1)%lake.points.length]));if(d<.9)h=mix(lake.elevation+320*d+520*d*d,h,smooth((d-.08)/.82));}
  for(let v of villages){let d=Math.hypot(x-v.points[0][0],y-v.points[0][1]);if(d<.85)h=mix(v.elevation+95*d*d,h,smooth((d-.15)/.7));}
  for(let v of valleys){if(x<v.minX-2.3||x>v.maxX+2.3||y<v.minY-2.3||y>v.maxY+2.3)continue;let n=nearest(v,x,y),d=n.d,floor=lineFloor(v,n),section=145*(d/.38)**2+180*Math.max(0,d-.55)**1.4;h=Math.min(h,floor+section);}
  field.values[j*401+i]=Math.round(clamp(h,1750,8800)*10)/10;
 }
 // Apply the exact lake/peak/saddle constraints before checking the spill surface.
 let constrained=fieldFor(doc.features,401,321,180,field);field.values=Array.from(constrained.values,v=>Math.round(v*10)/10);
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){let x=i*.05,y=j*.05,k=j*401+i;if(lakes.some(l=>inside([x,y],l.points)))continue;for(let v of valleys){if(x<v.minX-.7||x>v.maxX+.7||y<v.minY-.7||y>v.maxY+.7)continue;let n=nearest(v,x,y);if(n.d<.7){let section=145*(n.d/.38)**2;field.values[k]=Math.min(field.values[k],lineFloor(v,n)+section);}}}
 let correction=condition(field);
 // Follow the checked downhill grid, rather than leaving decorative rivers that
 // climb a slope where authored valley channels meet. Cardinal-cell tracing
 // also prevents a diagonal from cutting over a higher intermediate grid cell.
 let flow=drainageAudit(field);
 function trace(start,lake=null){let i=Math.round(start[0]*20),j=Math.round(start[1]*20),k=j*401+i,points=[];for(let n=0;n<field.values.length&&k>=0;n++){let p=[k%401*.05,Math.floor(k/401)*.05];if(!lake||!inside(p,lake.points))points.push(p);k=flow.parent[k];}return points;}
 for(let v of valleys.filter(v=>v.lakeId)){let lake=lakes.find(l=>l.id===v.lakeId),points=trace(centre(lake),lake);let f=doc.features.find(f=>f.id===v.id);if(!f){f={id:v.id,type:'river',name:v.name,closed:false,width:24};doc.features.push(f);}f.points=simplify(points,.012);f.flowDirection='points-order';}
 if(eastStream){eastStream.points=simplify(trace(eastStream.points[0]),.012);eastStream.flowDirection='points-order';}

 let lakeSpill=lakes.map(f=>({name:f.name,designElevation:f.elevation,outletElevation:Math.round(elevationAt(field,...centre(f)))}));
 let contours=contoursFrom(field,doc.contourInterval||200,.018);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}
 doc.features=[...contours,...doc.features];doc.terrainBase=field;doc.watershedShapeVersion=2;doc.rangeShapeVersion=1;doc.mountainShapeVersion=1;
 doc.terrainDesign={version:'alpine-watersheds-2',ridgeConnections:links.map(l=>({from:l.a.id,to:l.b.id,pass:l.passName,elevation:l.height})),ridgeCrossSection:'broad-convex-shoulders',drainage:correction,lakeOutlets:lakeSpill,references:['https://www.newsd.admin.ch/newsd/message/attachments/4742.pdf','https://www.swisstopo.admin.ch/dam/en/sd-web/9xOxcg3dR6CU/Flyer-newS50-EN.pdf','https://www.nps.gov/articles/ushapedvalleysfjordshangingvalleys.htm']};
 doc.notes='云岫山境：参考阿尔卑斯山群的分水岭、冰川槽谷和支谷层级重新设计的虚构地形，非实测 DEM。主脊与支脉不闭合；宽山肩连接峰体，五处高垭口；各湖设出流谷。底图通过边界优先泛洪检查并整理非预期洼地。';
 doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();return true;
}
