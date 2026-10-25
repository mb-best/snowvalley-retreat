import{clone,clamp,fieldFor,elevationAt,contoursFrom,inside,distanceSegment,simplify}from'./model.js?v=4';

const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mixPoint=(a,b,t,dx=0,dy=0)=>[a[0]+(b[0]-a[0])*t+dx,a[1]+(b[1]-a[1])*t+dy];
function curve(points){let out=[];for(let i=0;i<points.length-1;i++){let p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)],n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/.07));for(let j=0;j<n;j++){let t=j/n,t2=t*t,t3=t*t2;out.push([0,1].map(k=>clamp(.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3),0,k?16:20)));}}out.push([...points.at(-1)]);return out;}
function spine(a,b,passName,height,offset,phase){
 let start=a.points[0],end=b.points[0],pass=mixPoint(start,end,.5,...offset),points=curve([start,mixPoint(start,pass,.52,-.08,.03),pass,mixPoint(pass,end,.5,.08,-.02),end]);
 let lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
 let passIndex=points.reduce((best,p,i)=>Math.hypot(p[0]-pass[0],p[1]-pass[1])<Math.hypot(points[best][0]-pass[0],points[best][1]-pass[1])?i:best,0);
 return{a,b,name:passName,height:Math.min(height,a.elevation-300,b.elevation-300),pass,points,lengths,passS:lengths[passIndex],length:lengths.at(-1),phase,minX:Math.min(...points.map(p=>p[0]))-2.35,maxX:Math.max(...points.map(p=>p[0]))+2.35,minY:Math.min(...points.map(p=>p[1]))-2.35,maxY:Math.max(...points.map(p=>p[1]))+2.35};
}
function crest(link,s){let first=s<=link.passS,u=first?clamp(s/link.passS,0,1):clamp((link.length-s)/(link.length-link.passS),0,1),end=first?link.a.elevation:link.b.elevation;return Math.min(Math.max(link.a.elevation,link.b.elevation),link.height+(end-link.height)*(1-u)**1.35+115*Math.sin(u*3*Math.PI)**2*Math.sin(u*Math.PI)**2);}
function nearestOnSpine(link,x,y){let best=Infinity,along=0;for(let i=1;i<link.points.length;i++){let a=link.points[i-1],b=link.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1),d2=(x-a[0]-dx*t)**2+(y-a[1]-dy*t)**2;if(d2<best){best=d2;along=link.lengths[i-1]+Math.hypot(dx,dy)*t;}}return{distance:Math.sqrt(best),along};}
export function connectRanges(doc){
 if(doc.rangeShapeVersion>=1)return false;
 let peaks=Object.fromEntries(doc.features.filter(f=>f.type==='peak').map(f=>[f.id,f]));
 const specs=[
  ['north-peak','main-peak','雪隐垭口',5360,[.20,-.20]],
  ['main-peak','south-peak','归云垭口',5080,[-.30,.40]],
  ['west-peak','main-peak','听雪垭口',5280,[0,.65]],
  ['west-peak','sw-peak','松风垭口',5020,[-.20,0]],
  ['sw-peak','south-peak','栖霞垭口',4860,[-.60,1.0]],
  ['main-peak','east-peak','云桥垭口',5120,[.10,.05]],
  ['north-peak','east-peak','照岚垭口',4960,[.10,.08]],
 ];
 let links=specs.filter(([a,b])=>peaks[a]&&peaks[b]).map(([a,b,name,h,offset],i)=>spine(peaks[a],peaks[b],name,h,offset,i));
 if(!links.length)return false;
 let source=fieldFor(doc.features,401,321,400,doc.terrainBase),out={nx:401,ny:321,values:Array.from(source.values)},protectedFeatures=doc.features.filter(f=>f.type==='lake'||f.type==='village');
 for(let j=0;j<321;j++)for(let i=0;i<401;i++){
  let x=i*.05,y=j*.05,k=j*401+i,old=source.values[k],raised=old;
  for(let l of links){if(x<l.minX||x>l.maxX||y<l.minY||y>l.maxY)continue;let near=nearestOnSpine(l,x,y),d=near.distance,width=2.15+.12*Math.sin(near.along*2.1+l.phase);if(d>=width)continue;
   let h=crest(l,near.along),drop=(870+90*Math.sin(near.along*1.8+l.phase))*d**.85+260*d**1.65;
   let gullies=55*Math.sin(near.along*5.3+d*1.2+l.phase)**2*smooth(d/.25),target=h-drop-gullies,blend=1-smooth((d/width-.65)/.35);
   raised=Math.max(raised,old+Math.max(0,target-old)*blend);
  }
  if(raised<=old)continue;
  let keep=1;for(let f of protectedFeatures){let d;if(f.type==='village')d=Math.hypot(x-f.points[0][0],y-f.points[0][1])-.28;else{if(inside([x,y],f.points)){keep=0;break;}d=Infinity;for(let n=0;n<f.points.length;n++)d=Math.min(d,distanceSegment([x,y],f.points[n],f.points[(n+1)%f.points.length]));d-=.10;}keep=Math.min(keep,smooth(d/.55));}
  out.values[k]=Math.round((old+(raised-old)*keep)*10)/10;
 }
 // Replace the sketch's disconnected ridge traces with the physical ridge axes.
 const byName=Object.fromEntries(links.map(l=>[l.name,l]));
 const axes={
  'ridge-main':['雪隐垭口','归云垭口'],
  'ridge-west':['听雪垭口'],
  'ridge-sw':['松风垭口','栖霞垭口'],
  'ridge-east':['照岚垭口'],
  'ridge-link':['云桥垭口'],
 };
 for(let[id,names]of Object.entries(axes)){let pieces=names.map(n=>byName[n]).filter(Boolean);if(!pieces.length)continue;let f=doc.features.find(f=>f.id===id);if(!f){f={id,type:'ridge',name:pieces[0].name.replace('垭口','岭'),closed:false,points:[]};doc.features.push(f);}f.points=simplify(pieces.flatMap((p,i)=>i?p.points.slice(1):p.points),.025);f.terrainRole='crest';f.baselinePoints=clone(f.points);f.baselineElevation=0;}
 for(let l of links)doc.features.push({id:'pass-'+l.a.id+'-'+l.b.id,type:'label',constraint:'saddle',name:l.name,points:[l.pass],closed:false,elevation:l.height});
 let constrained=fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,220,out);out.values=Array.from(constrained.values,v=>Math.round(v*10)/10);
 let contours=contoursFrom(out,doc.contourInterval||200,.022);for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}
 doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];doc.terrainBase=out;doc.rangeShapeVersion=1;doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();
 return true;
}
