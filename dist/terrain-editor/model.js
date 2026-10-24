// Coordinates are kilometres east/south from the north-west corner. Elevations are metres.
export const WIDTH=20, HEIGHT=16, SCHEMA='snowvalley-terrain/1';
export const clone=v=>JSON.parse(JSON.stringify(v));
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const kinds={contour:'等高线',forest:'森林范围',meadow:'草甸范围',grassland:'草原范围',snow:'雪坡范围',lake:'湖岸范围',river:'河流',ridge:'山脊',trail:'步道',peak:'山峰',village:'村落',label:'注记'};
export const colors={contour:'#827559',forest:'#477357',meadow:'#a8a75f',grassland:'#9fb578',snow:'#a5b6bd',lake:'#72a7b6',river:'#5a94a8',ridge:'#8b7463',trail:'#bc9871',peak:'#736758',village:'#b08054',label:'#526357'};
const feature=(id,type,name,points,extra={})=>({id,type,name,points,closed:['forest','meadow','grassland','snow','lake'].includes(type),...extra});
export function baseHeight(x,y){
  const gaussian=(cx,cy,sx,sy,a)=>a*Math.exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2));
  let h=2390+100*Math.sin(x*.34+y*.21)+60*Math.cos(y*.8);
  // Three connected mountain systems, with lower valleys on either side.
  h+=gaussian(8.9,9.85,2.2,2.15,3260)+gaussian(8.95,4.7,.9,2.3,2320);
  h+=gaussian(3.3,6.45,1.5,1.8,2840)+gaussian(3.6,11.65,1.3,2,2340);
  h+=gaussian(7.2,15,.95,1.45,1930)+gaussian(13.8,8.5,1.5,2.1,1850);
  h+=gaussian(15.8,13.3,1.5,2.3,570)+gaussian(16.4,2.5,4,2,650);
  h+=gaussian(10.6,13.2,2,1,570)+gaussian(.2,1.6,.9,1.5,1180);
  h-=gaussian(6.2,3.2,1,1.9,490)+gaussian(6.8,6.8,.5,.8,450);
  h-=gaussian(14.7,4.65,1.35,.55,570)+gaussian(18.6,11.6,1.3,2.2,760);
  // Small coherent terrain variation, kept quieter than the main ridge structure.
  h+=40*Math.sin(x*2.3+y*.9)*Math.sin(y*1.8-x*.7);
  return clamp(h,1800,6084);
}
const ell=(x,y,rx,ry,n=16)=>Array.from({length:n},(_,i)=>{let a=i/n*Math.PI*2,r=1+.09*Math.sin(i*2.7);return[x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r]});
export function defaultFeatures(){return[
  feature('forest-west','forest','西麓森林',[[0,0],[4.8,0],[5.5,1.4],[5.8,3.4],[4.6,4.7],[2.4,4.2],[.6,5.2],[0,4.4]],{elevation:2600}),
  feature('forest-east','forest','东麓森林',[[12.7,5.4],[15.4,5],[18.4,4.5],[20,4.7],[20,9.2],[18.4,10],[16.8,9.6],[15.8,10.4],[14.8,9.2],[14.9,7.2]],{elevation:2800}),
  feature('grassland-ne','grassland','东北草原',[[11.8,0],[19.2,0],[19.8,1.5],[19.1,3.6],[18.4,4.4],[16.4,4],[15.1,4.6],[13.3,4.3],[12.5,3.5],[10.6,3.9],[10.1,2.8]],{elevation:3200}),
  feature('meadow-west','meadow','西坡草甸',[[1,3.6],[2.8,3.9],[4.2,4.8],[5.3,4.3],[5.6,6.4],[4.8,7.5],[2.8,7.7],[1,6.4]],{elevation:3500}),
  feature('snow-sw','snow','高山雪坡',[[3.3,7.8],[5.1,8.6],[7.3,8.8],[9.8,10.2],[8.7,12.4],[7.8,15.7],[5.8,15.8],[4,13.2],[3.1,11.4]],{elevation:5600}),
  feature('valley-south','meadow','南侧高谷',ell(11,13.2,1.6,.75),{elevation:4000}),
  feature('lake-north','lake','北侧高山湖',ell(6.95,6.9,.75,.36,14),{elevation:4000}),
  feature('lake-east','lake','草原海子',ell(14.7,4.65,.65,.25,14),{elevation:2500}),
  feature('lake-south','lake','南侧海子',ell(13.7,11.8,.38,.55,14),{elevation:3400}),
  feature('river-north','river','西谷河',[[5.1,0],[5.3,1.1],[6.5,1.5],[7.4,2.5],[7.9,3.4],[7.6,4.3],[7.3,5.4],[6.7,6.6],[6.95,6.9]],{width:40}),
  feature('river-east','river','草原溪流',[[11.8,0],[11.2,1.2],[10.3,2.3],[10.7,3.6],[12.4,3.9],[13.2,4.8],[14.7,4.65],[16.4,4.2],[17.8,4.6],[19.2,3.2],[19.8,1.8],[18.9,0]],{width:24}),
  feature('river-south','river','南谷溪流',[[12.2,9.8],[13.4,10.3],[14.1,10.9],[13.7,11.8],[13.4,13.1],[14.2,14.6],[15.7,15.3],[17.6,14.5],[17.3,13.3],[17.9,12.1],[18.4,10.8],[20,9.6]],{width:28}),
  feature('ridge-main','ridge','中央主脊',[[8.9,0],[8.8,2.3],[8.95,4.7],[9.5,6.7],[8.9,9.85],[7.9,12],[7.2,15]],{}),
  feature('ridge-west','ridge','西侧山脊',[[.4,0],[.5,2.3],[2,4.3],[3.3,6.45],[5.9,8],[8.9,9.85]],{}),
  feature('ridge-sw','ridge','西南山脊',[[3.3,6.45],[3.6,8.8],[3.6,11.65],[5.2,13.9],[7.2,15]],{}),
  feature('ridge-east','ridge','东侧山脊',[[10.3,5.6],[12.3,6.9],[13.8,8.5],[15.1,11.2],[16.5,15.4]],{}),
  feature('ridge-link','ridge','东向支脊',[[8.9,9.85],[11.4,9.5],[13.8,8.5]],{}),
  feature('trail-west','trail','西谷步道',[[6.15,2.9],[6.7,4.1],[6.9,5.5],[6.6,6.7],[5.5,8.2],[4.7,9.8],[3.1,10.5],[.7,9.4]],{}),
  feature('trail-east','trail','东谷步道',[[18.5,11.4],[16.4,11.1],[14,11.7],[12.5,10.4],[11.3,8.1],[11.8,6.1],[14.7,4.65]],{}),
  feature('main-peak','peak','主峰',[[8.9,9.85]],{elevation:6084}),
  feature('west-peak','peak','西侧卫峰',[[3.3,6.45]],{elevation:5700}),
  feature('sw-peak','peak','西南卫峰',[[3.6,11.65]],{elevation:5360}),
  feature('south-peak','peak','南侧卫峰',[[7.2,15]],{elevation:4800}),
  feature('north-peak','peak','北侧卫峰',[[8.95,4.7]],{elevation:5300}),
  feature('east-peak','peak','东侧卫峰',[[13.8,8.5]],{elevation:4500}),
  feature('village-nw','village','西北村',[[6.15,2.9]],{elevation:3000}),
  feature('village-west','village','西谷村',[[.7,9.4]],{elevation:3000}),
  feature('village-se','village','东南村',[[18.5,11.4]],{elevation:2000}),
];}
// Polygon / polyline geometry shared by editor, height solver and exported blueprint.
export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++)if((poly[i][1]>p[1])!==(poly[j][1]>p[1])&&p[0]<(poly[j][0]-poly[i][0])*(p[1]-poly[i][1])/(poly[j][1]-poly[i][1])+poly[i][0])yes=!yes;return yes;}
export function distanceSegment(p,a,b){let dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export function simplify(points,tolerance=.055){if(points.length<=2)return points;let max=0,index=0;for(let i=1;i<points.length-1;i++){let d=distanceSegment(points[i],points[0],points.at(-1));if(d>max){max=d;index=i}}return max>tolerance?[...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]:[points[0],points.at(-1)];}
export function samplePath(f,step=.055){let out=[];for(let i=0;i<f.points.length-(f.closed?0:1);i++){let a=f.points[i],b=f.points[(i+1)%f.points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let j=0;j<n;j++)out.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}if(!f.closed)out.push(f.points.at(-1));return out;}
const referenceFields=new Map();
export function fieldFor(features,nx=201,ny=161,iterations=300){
 let base=new Float32Array(nx*ny);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)base[j*nx+i]=baseHeight(i/(nx-1)*WIDTH,j/(ny-1)*HEIGHT);
 const solve=(pinFeatures,contours=false,reference=null)=>{
  let delta=new Float32Array(nx*ny),pins=new Float32Array(nx*ny),weight=new Uint16Array(nx*ny),priority=new Uint8Array(nx*ny);
  const pin=(x,y,d,p=1,exact=false)=>{let fx=clamp(x/WIDTH*(nx-1),0,nx-1),fy=clamp(y/HEIGHT*(ny-1),0,ny-1),cells=exact?[[Math.floor(fx),Math.floor(fy)],[Math.ceil(fx),Math.floor(fy)],[Math.floor(fx),Math.ceil(fy)],[Math.ceil(fx),Math.ceil(fy)]]:[[Math.round(fx),Math.round(fy)]];for(let[ix,iy]of cells){let k=iy*nx+ix;if(p<priority[k])continue;if(p>priority[k]){weight[k]=0;pins[k]=0;priority[k]=p;}pins[k]+=contours?d:d-base[k];weight[k]++;}};
  for(let f of pinFeatures){if(f.type==='contour'&&contours){let original=f.baselinePoints?.length===f.points.length?f.baselinePoints:null;for(let i=0;i<f.points.length-(f.closed?0:1);i++){let a=f.points[i],b=f.points[(i+1)%f.points.length],oa=original?.[i],ob=original?.[(i+1)%f.points.length],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(WIDTH/(nx-1)*.55)));for(let j=0;j<=n;j++){let t=j/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,under=elevationAt({values:base,nx,ny},x,y),target=f.elevation;if(original){let ox=oa[0]+(ob[0]-oa[0])*t,oy=oa[1]+(ob[1]-oa[1])*t;target=elevationAt(reference,ox,oy)+f.elevation-f.baselineElevation;}pin(x,y,target-under);}}}
   else if(f.type==='peak'||f.type==='village')pin(...f.points[0],contours?0:f.elevation,4,true);
   else if(f.type==='lake'){for(let p of samplePath(f,.055))pin(...p,contours?0:f.elevation,3);let xs=f.points.map(p=>p[0]),ys=f.points.map(p=>p[1]);for(let y=Math.min(...ys);y<Math.max(...ys);y+=HEIGHT/(ny-1))for(let x=Math.min(...xs);x<Math.max(...xs);x+=WIDTH/(nx-1))if(inside([x,y],f.points))pin(x,y,contours?0:f.elevation,3);}}
  for(let k=0;k<base.length;k++)if(weight[k])delta[k]=pins[k]/weight[k];
  for(let it=0;it<iterations;it++)for(let parity=0;parity<2;parity++)for(let j=1;j<ny-1;j++)for(let i=1+((j+parity)%2);i<nx-1;i+=2){let k=j*nx+i;if(!weight[k]){let target=(delta[k-1]+delta[k+1]+delta[k-nx]+delta[k+nx])/4.004;delta[k]+=1.42*(target-delta[k]);}}
  for(let k=0;k<base.length;k++)base[k]=clamp(base[k]+delta[k],0,9000);
 };
 solve(features);
 if(features.some(f=>f.type==='contour')){let key=nx+'x'+ny+'x'+iterations;if(!referenceFields.has(key))referenceFields.set(key,fieldFor(defaultFeatures(),nx,ny,iterations));solve(features,true,referenceFields.get(key));}
 return{values:base,nx,ny};
}
export function elevationAt(field,x,y){let fx=clamp(x/WIDTH*(field.nx-1),0,field.nx-1),fy=clamp(y/HEIGHT*(field.ny-1),0,field.ny-1),i=Math.min(field.nx-2,Math.floor(fx)),j=Math.min(field.ny-2,Math.floor(fy)),u=fx-i,v=fy-j,k=j*field.nx+i;return(1-v)*((1-u)*field.values[k]+u*field.values[k+1])+v*((1-u)*field.values[k+field.nx]+u*field.values[k+field.nx+1]);}
export function contoursFrom(field,step=200){
 let features=[];const {values:a,nx,ny}=field;
 for(let level=2000;level<=6200;level+=step){let edges=[],links=new Map();const key=p=>p.map(v=>v.toFixed(5)).join(',');const add=(p,q)=>{let i=edges.length;edges.push([p,q]);for(let v of[p,q]){let k=key(v);if(!links.has(k))links.set(k,[]);links.get(k).push(i)}};
 for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){let points=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],v=[a[y*nx+x],a[y*nx+x+1],a[(y+1)*nx+x+1],a[(y+1)*nx+x]],cross=[];for(let e=0;e<4;e++){let b=(e+1)%4;if((v[e]<level)!==(v[b]<level)){let t=(level-v[e])/(v[b]-v[e]);cross.push([(points[e][0]+(points[b][0]-points[e][0])*t)/(nx-1)*WIDTH,(points[e][1]+(points[b][1]-points[e][1])*t)/(ny-1)*HEIGHT]);}}if(cross.length===2)add(cross[0],cross[1]);else if(cross.length===4){add(cross[0],cross[1]);add(cross[2],cross[3]);}}
 let used=new Set(),paths=[];for(let e=0;e<edges.length;e++){if(used.has(e))continue;let p=[...edges[e]];used.add(e);for(let end of[false,true]){while(true){let point=end?p.at(-1):p[0],next=links.get(key(point))?.find(i=>!used.has(i));if(next===undefined)break;used.add(next);let edge=edges[next],other=key(edge[0])===key(point)?edge[1]:edge[0];if(end)p.push(other);else p.unshift(other);}}let closed=Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01;if(p.length<7)continue;let simple=simplify(p,.055);if(closed)simple.pop();if(simple.length<3)continue;let length=p.reduce((sum,q,i)=>i?sum+Math.hypot(q[0]-p[i-1][0],q[1]-p[i-1][1]):0,0);if(length>.55)paths.push({points:simple,closed});}
 paths.forEach((p,i)=>features.push(feature(`contour-${level}-${i}`,'contour',`${level.toLocaleString()} m 等高线`,p.points,{closed:p.closed,elevation:level})));
 }return features;
}
export function makeDocument(){let features=defaultFeatures(),field=fieldFor(features),contours=contoursFrom(field);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}return{schema:SCHEMA,title:'雪隐山居 · 山谷地形',revision:1,bounds:{widthKm:WIDTH,heightKm:HEIGHT,areaKm2:320,origin:'north-west',xAxis:'east',yAxis:'south'},units:{horizontal:'km',elevation:'m'},contourInterval:200,features:[...contours,...features],notes:'根据手绘草图模拟的地形设计，非实测地理数据。草图中的山峰、村落和海子高程为可修改的设计约束。等高线采用基准线形与位移约束，避免网格量化产生阶梯；区域内的峰点和湖面高程优先。'};}
export function validateDocument(doc){
 if(!doc||doc.schema!==SCHEMA||doc.bounds?.widthKm!==20||doc.bounds?.heightKm!==16||!Array.isArray(doc.features)||doc.features.length>1000)throw Error('请选择本编辑器导出的 20 × 16 km 地形设计 JSON。');
 let ids=new Set(),total=0;
 const validPoints=points=>Array.isArray(points)&&points.length>0&&points.length<=1500&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=20&&p[1]>=0&&p[1]<=16);
 for(let f of doc.features){if(!f||!Object.prototype.hasOwnProperty.call(kinds,f.type)||typeof f.name!=='string'||f.name.length>100||typeof f.id!=='string'||f.id.length>120||ids.has(f.id)||!validPoints(f.points)||((['contour','lake','peak','village'].includes(f.type))&&(!Number.isFinite(f.elevation)||f.elevation<0||f.elevation>9000))||(f.baselinePoints&&(!validPoints(f.baselinePoints)||!Number.isFinite(f.baselineElevation)||f.baselineElevation<0||f.baselineElevation>9000))||(!['peak','village','label'].includes(f.type)&&f.points.length<(f.closed?3:2)))throw Error('设计文件包含不合法的图形或高程，未覆盖当前地图。');ids.add(f.id);total+=f.points.length;}
 if(total>80000)throw Error('节点过多，请简化设计后再导入。');
 return doc;
}
