import{clone,clamp,fieldFor,elevationAt,contoursFrom,inside,distanceSegment}from'./model.js?v=3';

// A full-resolution elevation base preserves the user's valley design while we
// rebuild the six summit masses. Subsequent contour edits deform this base.
const profiles={
 'main-peak':{height:6840,radius:3.15,angle:.26,stretch:1.12,faces:[1.02,.77,1.1,.86,1.15,.80],gullies:[.8,2.5,4.7],power:1.55},
 'west-peak':{height:6380,radius:2.55,angle:-.38,stretch:1.31,faces:[1.12,.73,.94,1.15,.76,1.0],gullies:[1.4,3.8,5.3],power:1.65},
 'sw-peak':{height:6060,radius:2.35,angle:.85,stretch:1.15,faces:[.95,1.13,.77,1.08,.86,1.15],gullies:[.4,2.9,4.5],power:1.62,shoulder:[.55,-.38,520]},
 'south-peak':{height:5740,radius:2.3,angle:-.2,stretch:1.18,faces:[1.1,.82,1.16,.91,.75,1.1],gullies:[1.0,3.6,5.5],power:1.62},
 'north-peak':{height:6360,radius:2.18,angle:1.35,stretch:1.39,faces:[1.02,.79,1.08,1.12,.85,.97],gullies:[.3,2.4,4.2],power:1.4},
 'east-peak':{height:5680,radius:2.55,angle:-.62,stretch:1.02,faces:[1.15,.84,.94,.72,1.14,.91],gullies:[1.4,3.1,5.2],power:1.72,shoulder:[-.5,-.4,650]},
};
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function angularDistance(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
function summitHeight(p,dx,dy,foot){
 let c=Math.cos(p.angle),s=Math.sin(p.angle),u=(dx*c+dy*s)/p.stretch,v=(-dx*s+dy*c)*p.stretch,r=Math.hypot(u,v),theta=Math.atan2(v,u);
 let face=0;for(let i=0;i<6;i++)face=Math.max(face,(u*Math.cos(i*Math.PI/3)+v*Math.sin(i*Math.PI/3))*p.faces[i]);
 // Unequal planar faces give a rock pyramid; narrow glacial gullies break its
 // contours into ridges rather than regular circular or flower-shaped rings.
 let metric=.18*r+.82*face;
 for(let[i,a]of p.gullies.entries()){let d=angularDistance(theta,a),spread=.14+i*.025;metric+=r*(.14+i*.035)*Math.exp(-.5*(d/spread)**2)*smooth(r/.28);}
 let h=foot+(p.height-foot)*Math.max(0,1-metric/p.radius)**p.power;
 if(p.shoulder){let[a,b,drop]=p.shoulder,rr=Math.hypot((u-a)/.75,(v-b)/1.1);let secondary=foot+(p.height-foot-drop)*Math.max(0,1-rr/(p.radius*.79))**1.55;h=Math.max(h,secondary);}
 let texture=(Math.sin(u*9+v*3)*Math.sin(v*7-u*2)*22+Math.sin(u*17-v*11)*8)*smooth(r/.24)*smooth((p.radius-r)/.5);
 return{height:h+texture,r};
}
export function sharpenDraft(doc){
 if(doc.mountainShapeVersion>=1)return false;
 let original=fieldFor(doc.features,401,321,400,doc.terrainBase),massifs=[];
 for(let f of doc.features){let spec=profiles[f.id];if(f.type!=='peak'||!spec)continue;let p={...spec,x:f.points[0][0],y:f.points[0][1],height:Math.max(spec.height,Math.min(8500,f.elevation+350))};
  let ring=Array.from({length:16},(_,i)=>{let a=i*Math.PI/8;return elevationAt(original,p.x+Math.cos(a)*p.radius,p.y+Math.sin(a)*p.radius);}).sort((a,b)=>a-b);
  p.foot=clamp((ring[6]+ring[9])/2,2200,p.height-2300);p.feature=f;massifs.push(p);
 }
 const protectedFeatures=doc.features.filter(f=>f.type==='lake'||f.type==='village');
 let out={nx:401,ny:321,values:Array.from(original.values)};
 for(let j=0;j<out.ny;j++)for(let i=0;i<out.nx;i++){
  let x=i*.05,y=j*.05,k=j*out.nx+i,old=original.values[k],sum=0,weight=0;
  for(let p of massifs){let dx=x-p.x,dy=y-p.y,shape=summitHeight(p,dx,dy,p.foot),r=shape.r/p.radius;if(r>=1)continue;
   let w=1-smooth((r-.62)/.38);sum+=(shape.height-old)*w;weight+=w;
  }
  if(!weight)continue;
  let keep=1;for(let f of protectedFeatures){let d;if(f.type==='village')d=Math.hypot(x-f.points[0][0],y-f.points[0][1])-.28;else{if(inside([x,y],f.points)){keep=0;break;}d=Infinity;for(let n=0;n<f.points.length;n++)d=Math.min(d,distanceSegment([x,y],f.points[n],f.points[(n+1)%f.points.length]));d-=.10;}keep=Math.min(keep,smooth(d/.55));}
  out.values[k]=Math.round(clamp(old+sum/Math.max(1,weight)*keep,1200,8800)*10)/10;
 }
 for(let p of massifs){p.feature.elevation=p.height;p.feature.summitForm='alpine-rock-ridges';}
 // Enforce the user's lake planes, settlements, and the new summit heights
 // before tracing all level lines from one continuous, non-crossing field.
 let shaped=fieldFor(doc.features.filter(f=>f.type!=='contour'),401,321,220,out);
 out.values=Array.from(shaped.values,v=>Math.round(v*10)/10);
 let contours=contoursFrom(out,doc.contourInterval||200,.022);
 for(let f of contours){f.baselinePoints=clone(f.points);f.baselineElevation=f.elevation;}
 doc.features=[...contours,...doc.features.filter(f=>f.type!=='contour')];
 doc.terrainBase=out;doc.mountainShapeVersion=1;
 doc.revision=(Number(doc.revision)||1)+1;doc.updatedAt=new Date().toISOString();
 return true;
}
