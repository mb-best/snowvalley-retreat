import{clone,fieldFor,elevationAt,contoursFrom,samplePath,inside}from'./model.js?v=7';
export const REPAIR_IDS=['green-mist-peak','mist-ferry-peak'];
export const REPAIR_RADIUS=.65;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);},dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),same=(a,b)=>dist(a,b)<1e-7;

// Split at exact disk intersections; retain every original outside vertex.
function cut(f,circles,wantInside){
 let pieces=[],current=[];const finish=()=>{if(current.length>1)pieces.push(current);current=[];};
 for(let i=0;i<f.points.length-(f.closed?0:1);i++){
  const a=f.points[i],b=f.points[(i+1)%f.points.length],dx=b[0]-a[0],dy=b[1]-a[1],aa=dx*dx+dy*dy,ts=[0,1];
  if(aa)for(const c of circles){const ox=a[0]-c[0],oy=a[1]-c[1],bb=2*(ox*dx+oy*dy),cc=ox*ox+oy*oy-REPAIR_RADIUS**2,disc=bb*bb-4*aa*cc;if(disc>=0)for(const t of[(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)])if(t>1e-9&&t<1-1e-9)ts.push(t);}
  ts.sort((a,b)=>a-b);for(let j=1;j<ts.length;j++){const t=(ts[j-1]+ts[j])/2,yes=circles.some(c=>Math.hypot(a[0]+dx*t-c[0],a[1]+dy*t-c[1])<REPAIR_RADIUS);if(yes!==wantInside){finish();continue;}const p=ts[j-1]===0?[...a]:[a[0]+dx*ts[j-1],a[1]+dy*ts[j-1]],q=ts[j]===1?[...b]:[a[0]+dx*ts[j],a[1]+dy*ts[j]];if(!current.length)current.push(p);else if(!same(current.at(-1),p)){finish();current.push(p);}current.push(q);}
 }
 finish();if(f.closed&&pieces.length>1&&same(pieces.at(-1).at(-1),pieces[0][0]))pieces=[pieces.at(-1).slice(0,-1).concat(pieces[0]),...pieces.slice(1,-1)];return pieces;
}
function contourPieces(features,circles,insidePart){let out=[];for(const f of features)for(const points of cut(f,circles,insidePart)){const closed=same(points[0],points.at(-1));if(closed)points.pop();if(points.length>=(closed?3:2))out.push({...clone(f),points,closed});}return out;}
function stitch(outside,inner){
 const all=[...outside.map(f=>({...f,fixed:[true,true]})),...inner.map(f=>({...f,fixed:[false,false]}))];
 const compatible=(f,a,g,b,d)=>d<(f.fixed[a]===g.fixed[b]?1e-6:.18),reverse=f=>{f.points.reverse();f.fixed.reverse();};
 let changed=true;while(changed){changed=false;let best=null;
  for(let i=0;i<all.length;i++){let f=all[i];if(!f||f.closed)continue;for(let j=i+1;j<all.length;j++){let g=all[j];if(!g||g.closed||g.elevation!==f.elevation)continue;for(let a=0;a<2;a++)for(let b=0;b<2;b++){let d=dist(f.points[a?f.points.length-1:0],g.points[b?g.points.length-1:0]);if(compatible(f,a,g,b,d)&&(!best||d<best.d))best={i,j,a,b,d};}}}
  if(best){let f=all[best.i],g=all[best.j];if(!best.a)reverse(f);if(best.b)reverse(g);if(f.fixed[1])g.points[0]=[...f.points.at(-1)];else f.points[f.points.length-1]=[...g.points[0]];f.points.push(...g.points.slice(1));f.fixed[1]=g.fixed[1];all[best.j]=null;changed=true;}
 }
 for(const f of all){if(!f||f.closed)continue;const d=dist(f.points[0],f.points.at(-1));if(f.points.length>3&&compatible(f,0,f,1,d)){if(f.fixed[0])f.points[f.points.length-1]=[...f.points[0]];else f.points[0]=[...f.points.at(-1)];f.points.pop();f.closed=true;}else if(!f.fixed.every(Boolean))throw Error('局部等高线未完整接回原图，当前地图已保留。');}
 return all.filter(Boolean).map(({fixed,...f})=>f);
}

export function repairTwinSummits(document){
 if(document.summitRepairVersion>=1)return null;
 if(!document.terrainBase||!REPAIR_IDS.every(id=>document.features.some(f=>f.id===id)))throw Error('当前草案没有完整的两座峰体，未进行修补。');
 const doc=clone(document),before=fieldFor(doc.features,401,321,500,doc.terrainBase),values=Array.from(before.values),peaks=REPAIR_IDS.map(id=>doc.features.find(f=>f.id===id)),circles=peaks.map(f=>f.points[0]);
 if(dist(circles[0],circles[1])<=REPAIR_RADIUS*2)throw Error('两座峰体的修补范围重叠，当前草案已保留。');
 for(const f of peaks)for(let i=0;i<64;i++){const angle=i/64*Math.PI*2,[x,y]=f.points[0];if(elevationAt(before,x+REPAIR_RADIUS*Math.cos(angle),y+REPAIR_RADIUS*Math.sin(angle))>=f.elevation-20)throw Error(`${f.name}周边存在接近或超过峰顶的山体，请导出当前设计以便局部核对。`);}
 for(const f of doc.features){if(REPAIR_IDS.includes(f.id))continue;const protectedFeature=['river','lake','waterfall','village','peak'].includes(f.type)||f.constraint==='saddle';if(!protectedFeature)continue;if(f.type==='lake'&&circles.some(c=>inside(c,f.points)))throw Error(`${f.name}覆盖峰体，当前草案已保留。`);for(const p of samplePath(f,.025))if(circles.some(c=>dist(p,c)<REPAIR_RADIUS+.025))throw Error(`${f.name}进入峰体修补范围，请导出当前设计以便局部核对。`);}
 // One summit with a different shoulder profile in each direction, fitted to
 // the existing disk boundary. Blend only the outer 170 m back into the map.
 for(const f of peaks){const[cx,cy]=f.points[0];for(let j=Math.max(0,Math.floor((cy-REPAIR_RADIUS)*20));j<=Math.min(320,Math.ceil((cy+REPAIR_RADIUS)*20));j++)for(let i=Math.max(0,Math.floor((cx-REPAIR_RADIUS)*20));i<=Math.min(400,Math.ceil((cx+REPAIR_RADIUS)*20));i++){
   const x=i*.05,y=j*.05,r=Math.hypot(x-cx,y-cy);if(r>=REPAIR_RADIUS)continue;const angle=Math.atan2(y-cy,x-cx),edge=elevationAt(before,cx+REPAIR_RADIUS*Math.cos(angle),cy+REPAIR_RADIUS*Math.sin(angle)),target=f.elevation-(f.elevation-edge)*r/REPAIR_RADIUS,w=1-smooth((r-.48)/(REPAIR_RADIUS-.48)),k=j*401+i;values[k]+=(target-values[k])*w;
  }
  for(const j of[Math.floor(cy*20),Math.ceil(cy*20)])for(const i of[Math.floor(cx*20),Math.ceil(cx*20)])values[j*401+i]=f.elevation;
 }
 const after={nx:401,ny:321,values},affected=doc.features.filter(f=>f.type==='contour'&&cut(f,circles,true).length),outside=contourPieces(affected,circles,false),levels=[...new Set(affected.map(f=>f.elevation))];
 let regenerated=contoursFrom(after,doc.contourInterval||200,.008);
 for(const level of levels)if(level%(doc.contourInterval||200)){const shifted={...after,values:values.map(v=>v+2000-level)};regenerated.push(...contoursFrom(shifted,200,.008).filter(f=>f.elevation===2000).map(f=>({...f,elevation:level,name:`${level.toLocaleString()} m 等高线` })));}
 const local=stitch(outside,contourPieces(regenerated,circles,true)),affectedIds=new Set(affected.map(f=>f.id)),used=new Set(doc.features.filter(f=>!affectedIds.has(f.id)).map(f=>f.id));
 for(let i=0;i<local.length;i++){const f=local[i];if(used.has(f.id))f.id=`summit-repair-${f.elevation}-${i}`;used.add(f.id);}
 doc.features=[...doc.features.filter(f=>!affectedIds.has(f.id)),...local];doc.terrainBase=after;
 let ecologyCellsChanged=0;const grid=doc.ecology?.grid;if(grid)for(let j=0;j<160;j++)for(let i=0;i<200;i++){const x=(i+.5)*.1,y=(j+.5)*.1;if(!circles.some(c=>dist([x,y],c)<REPAIR_RADIUS))continue;const k=j*200+i,h=elevationAt(after,x,y),old=[grid.tree[k],grid.grass[k],grid.shrub[k],grid.community[k]];if(h>grid.forestLine[k])grid.tree[k]=0;if(h>grid.meadowLine[k]){grid.grass[k]=0;grid.community[k]=7;}if(h>grid.meadowLine[k]+120)grid.shrub[k]=0;if(old.some((v,n)=>v!==[grid.tree[k],grid.grass[k],grid.shrub[k],grid.community[k]][n]))ecologyCellsChanged++;}
 // Rebase the user's current surface so existing edits are frozen in place.
 for(const f of doc.features)if(['contour','lake','waterfall'].includes(f.type)||f.terrainRole==='crest'){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation||0;if(['lake','waterfall'].includes(f.type))f.terrainBaked=true;if(f.type==='waterfall')f.baselineDrop=f.drop;}
 doc.summitRepairVersion=1;doc.revision=(doc.revision||0)+1;doc.updatedAt=new Date().toISOString();doc.summitRepair={ids:REPAIR_IDS,radiusKm:REPAIR_RADIUS,centres:circles,method:'local single summit and boundary-following shoulders; unchanged outside repair disks'};
 const final=fieldFor(doc.features,401,321,500,doc.terrainBase);let outsideMax=0,maxChange=0,changedCells=0;for(let j=0;j<321;j++)for(let i=0;i<401;i++){const k=j*401+i,d=Math.abs(final.values[k]-before.values[k]);maxChange=Math.max(maxChange,d);if(d>1e-4)changedCells++;if(!circles.some(c=>dist([i*.05,j*.05],c)<REPAIR_RADIUS))outsideMax=Math.max(outsideMax,d);}
 if(outsideMax>.01)throw Error('修补影响超出两座峰体，当前草案已保留。');
 return{document:doc,before,field:final,summary:{outsideMaxMetres:outsideMax,maxChangeMetres:maxChange,changedCells,ecologyCellsChanged,affectedContourIds:[...affectedIds],replacementContours:local.length}};
}
