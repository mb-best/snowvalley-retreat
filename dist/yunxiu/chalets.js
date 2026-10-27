import * as T from '../vendor/three.module.js';
import {woodMaterial,clayMaterial,stoneMaterial} from '../sunny/art-materials.js?v=2';

// A chalet is a batched, full-size asset. Its front faces local +Z. The
// caller supplies terrain placement/rotation; no terrain is modified here.
const TAU=Math.PI*2,up=new T.Vector3(0,1,0),materialCache=new Map();
function random(seed){let n=(Number(seed)||1)>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function materials(variant){
 if(materialCache.has(variant))return materialCache.get(variant);
 const plaster=clayMaterial();plaster.color.set(['#e9e2ce','#e4dbc4','#eee5d6'][variant%3]);
 const stone=stoneMaterial();stone.color.set('#c0bba9');
 const roof=clayMaterial();roof.vertexColors=true;roof.side=T.DoubleSide;
 const petals=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:.87});
 const foliage=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.98});
 const m={stone,plaster,timber:woodMaterial('#70573f'),boards:woodMaterial(['#a48b68','#92795b','#ad926c'][variant%3]),trim:woodMaterial('#bcaa82'),roof,
  shutter:woodMaterial(['#718a7a','#8a4f42','#6c7b81','#a08959'][variant%4]),
  glass:new T.MeshStandardMaterial({color:'#8badaf',roughness:.19,metalness:.16,emissive:'#b6a06b',emissiveIntensity:.035}),
  metal:new T.MeshStandardMaterial({color:'#55544b',metalness:.42,roughness:.62}),
  recess:new T.MeshStandardMaterial({color:'#423a30',roughness:1}),foliage,petals,
  lamp:new T.MeshStandardMaterial({color:'#edd5a0',roughness:.33,emissive:'#e3af64',emissiveIntensity:.45})};
 for(const [name,mat]of Object.entries(m)){mat.name='Yunxiu chalet '+name;mat.userData.chaletSurface=name;}
 materialCache.set(variant,m);return m;
}

class Batch{
 constructor(mats){this.mats=mats;this.parts=new Map();this.matrix=new T.Matrix4();this.q=new T.Quaternion();this.v=new T.Vector3();}
 add(key,geometry,x=0,y=0,z=0,rotation=null,tint=null){
  if(key==='foliage'&&!tint)tint='#628749';
  this.q.setFromEuler(new T.Euler(...(rotation||[0,0,0])));this.matrix.compose(this.v.set(x,y,z),this.q,new T.Vector3(1,1,1));geometry.applyMatrix4(this.matrix);
  const source=geometry.index?geometry.toNonIndexed():geometry;if(source!==geometry)geometry.dispose();
  let list=this.parts.get(key);if(!list)this.parts.set(key,list=[]);list.push({geometry:source,tint:tint?new T.Color(tint):new T.Color(0xffffff)});
 }
 box(key,x,y,z,w,h,d,rotation=null,tint=null){this.add(key,new T.BoxGeometry(w,h,d),x,y,z,rotation,tint);}
 beam(key,a,b,r=.07,tip=r){const aa=new T.Vector3(...a),bb=new T.Vector3(...b),delta=bb.clone().sub(aa),g=new T.CylinderGeometry(tip,r,delta.length(),6),q=new T.Quaternion().setFromUnitVectors(up,delta.normalize());g.applyQuaternion(q);this.add(key,g,...aa.add(bb).multiplyScalar(.5).toArray());}
 finish(root){let triangles=0;for(const[key,parts]of this.parts){const positions=[],normals=[],uvs=[],colors=[];for(const {geometry:g,tint:c}of parts){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n?n.getX(i):0,n?n.getY(i):1,n?n.getZ(i):0);uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);colors.push(c.r,c.g,c.b);}g.dispose();}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeBoundingBox();geo.computeBoundingSphere();const mesh=new T.Mesh(geo,this.mats[key]);mesh.name='Chalet '+key;mesh.castShadow=key!=='glass'&&key!=='petals';mesh.receiveShadow=true;root.add(mesh);triangles+=positions.length/9;}return triangles;}
}

function facadePoint(x,y,z,side){return side?[z,y,x]:[x,y,z];}
function facadeBox(batch,key,x,y,z,w,h,d,side=false,tint=null){const p=facadePoint(x,y,z,side);batch.box(key,...p,side?d:w,h,side?w:d,null,tint);}
function windowAt(batch,x,y,z,{side=false,large=false,flowers=true,rnd}){
 const w=large?1.5:1.12,h=large?1.55:1.35;
 const box=(key,xx,yy,zz,a,b,c,tint=null)=>facadeBox(batch,key,xx,yy,zz,a,b,c,side,tint);
 box('recess',x,y,z,w+.25,h+.25,.16);box('glass',x,y,z+.105,w,h,.055);
 for(const s of[-1,1]){box('trim',x+s*(w/2+.055),y,z+.17,.105,h+.28,.11);box('shutter',x+s*(w*.5+.36),y,z+.15,.45,h+.17,.085);for(let k=0;k<6;k++)box('trim',x+s*(w*.5+.36),y-h*.4+k*h*.16,z+.207,.38,.025,.035);}
 box('trim',x,y+h/2+.07,z+.18,w+.30,.12,.13);box('trim',x,y-h/2-.08,z+.22,w+.42,.14,.33);
 box('trim',x,y,z+.18,.055,h,.05);box('trim',x,y+.035,z+.18,w,.055,.05);
 // Curtains are behind the frame, with an open centre rather than an opaque
 // rectangle pasted over the glass.
 for(const s of[-1,1])box('plaster',x+s*w*.35,y-.06,z+.14,w*.14,h*.81,.015);
 if(flowers){const yy=y-h/2-.35;box('boards',x,yy,z+.43,w+.35,.27,.44);box('recess',x,yy+.15,z+.43,w+.19,.035,.30);for(let k=0;k<6;k++){const xx=x+(k/5-.5)*(w+.1),zz=z+.43+(rnd()-.5)*.2;plant(batch,...facadePoint(xx,yy+.22,zz,side),rnd,.23+.05*rnd(),k%3===0?'#e6b4bb':'#b55351');}}
}

function plant(batch,x,y,z,rnd,size=.32,color='#d98fa1'){
 const leaves=new T.IcosahedronGeometry(size*.55,0);leaves.scale(1,.5,.85);batch.add('foliage',leaves,x,y-size*.04,z,[0,rnd()*TAU,0],rnd()<.5?'#527d45':'#6c8d4c');
 for(let k=0;k<3;k++){const a=rnd()*TAU,xx=x+Math.cos(a)*size*.29,zz=z+Math.sin(a)*size*.29,yy=y+size*(.13+rnd()*.25);batch.beam('foliage',[xx,y-.12,zz],[xx,yy,zz],.009);for(let j=0;j<5;j++){const aa=j*TAU/5,g=new T.PlaneGeometry(size*.30,size*.48);g.rotateX(-Math.PI/2);g.rotateY(aa);g.translate(Math.cos(aa)*size*.12,0,Math.sin(aa)*size*.12);batch.add('petals',g,xx,yy,zz,null,color);}const c=new T.IcosahedronGeometry(size*.07,0);batch.add('petals',c,xx,yy+.015,zz,null,'#e6c279');}
}

function foundation(batch,w,d,corners,rnd){
 const ys=corners.map(v=>Math.min(-.22,Number(v)||0)-.18),vertices=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]],p=[],uv=[];
 for(let i=0;i<4;i++){const j=(i+1)%4,a=vertices[i],b=vertices[j];for(const q of[[a[0],.15,a[2]],[b[0],.15,b[2]],[a[0],ys[i],a[2]],[b[0],.15,b[2]],[b[0],ys[j],b[2]],[a[0],ys[i],a[2]]]){p.push(...q);uv.push(q[0]*.5+q[2]*.5,q[1]*.5);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();batch.add('stone',g);
 batch.box('stone',0,.12,0,w+.26,.24,d+.26);
 // Visible coursed front stones give the foundation thickness and a human
 // scale. Large buried portions remain a single continuous stone wall.
 const low=Math.min(ys[2],ys[3]),rows=Math.min(9,Math.max(1,Math.ceil(-low/.36))),cols=Math.ceil(w/.82);
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){let x=-w/2+(i+.5)*w/cols+(j%2?.20:0);if(x>w/2-.18)continue;batch.box('stone',x,-.10-j*.35,d/2+.045,w/cols-.035,.31,.14,[0,0,(rnd()-.5)*.035]);}
 if(low<-1.7)for(const s of[-1,1]){batch.box('recess',s*w*.30,-1.02,d/2+.09,1.12,.62,.06);batch.box('glass',s*w*.30,-1.02,d/2+.14,.93,.45,.045);for(let i=0;i<4;i++)batch.box('metal',s*w*.30-.37+i*.25,-1.02,d/2+.18,.022,.51,.025);}
}

function roof(batch,w,d,eaveY,pitch,rnd,variant){
 const overhang=1.12,half=w/2+overhang,deep=d+2.1,ridge=eaveY+half*Math.tan(pitch),slope=half/Math.cos(pitch),tones=variant%3===0?['#80898a','#707b7d','#909796','#6d7778']:variant%3===1?['#946a51','#a3765c','#8e614e','#ad8062']:['#797565','#91866f','#827a66','#716e62'];
 for(const side of[-1,1]){
  const x=side*half*.5,y=(ridge+eaveY)*.5;
  batch.box('roof',x,y,0,slope,.18,deep,[0,0,-side*pitch],tones[0]);
  batch.box('timber',side*half,eaveY-.08,0,.18,.22,deep+.1);
  const rows=Math.max(4,Math.ceil(slope/.65)),cols=Math.max(7,Math.ceil(deep/.62));
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const t=(row+.52)/rows,xx=side*half*t,zz=-deep/2+(col+.5)*deep/cols+(row%2?.08:0);if(zz>deep/2-.10)continue;const geo=new T.PlaneGeometry(slope/rows*1.04,deep/cols*.98,1,2);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,.025*Math.cos(pos.getZ(i)/(deep/cols)*Math.PI));geo.computeVertexNormals();batch.add('roof',geo,xx,ridge-Math.abs(xx)*Math.tan(pitch)+.115,zz,[0,0,-side*pitch],tones[Math.floor(rnd()*tones.length)]);}
  for(const z of[-deep/2-.035,deep/2+.035])batch.beam('timber',[side*half,eaveY-.04,z],[0,ridge+.07,z],.10,.10);
 }
 for(let z=-deep/2+.18;z<deep/2;z+=.46){const cap=new T.CylinderGeometry(.17,.17,.50,8,1,true,Math.PI/2,Math.PI);cap.rotateX(Math.PI/2);batch.add('roof',cap,0,ridge+.11,z,null,tones[2]);}
 // Exposed purlins under the front overhang and carved support brackets.
 for(const x of[-w*.37,0,w*.37]){const y=ridge-Math.abs(x)*Math.tan(pitch)-.27;batch.box('timber',x,y,d/2+.45,.19,.23,1.65);batch.beam('timber',[x,y-.7,d/2+.07],[x,y-.07,d/2+.73],.065);}
 return ridge+.27;
}

function barrel(batch,x,y,z,rnd){
 const geo=new T.CylinderGeometry(.32,.29,.77,10,2);batch.add('boards',geo,x,y+.385,z,[0,rnd()*TAU,0]);for(const yy of[.15,.60]){const ring=new T.TorusGeometry(.315,.025,3,10);ring.rotateX(Math.PI/2);batch.add('metal',ring,x,y+yy,z);}batch.add('timber',new T.CylinderGeometry(.29,.29,.045,10),x,y+.785,z);
}

export function createChalet({seed=1,width=11,depth=9,lodge=false,groundCorners=[0,0,0,0]}={}){
 const rnd=random(seed),variant=Math.abs(Math.floor(Number(seed)||1))%12,w=Math.max(7,Math.min(22,width)),d=Math.max(6,Math.min(19,depth)),mats=materials(variant),batch=new Batch(mats),group=new T.Group();
 group.name=lodge?'Swiss mountain lodge':'Swiss alpine chalet';
 const lower=3.05,upper=lodge?3.02:2.72,eave=lower+upper+.06,pitch=.46+rnd()*.10,front=d/2,half=w/2;
 foundation(batch,w+.1,d+.1,groundCorners,rnd);
 batch.box('plaster',0,lower/2,0,w,lower,d);
 batch.box('recess',0,lower+upper/2,0,w-.10,upper,d-.10);
 // Horizontal weatherboards stand off the dark wall, giving narrow recessed
 // seams without adding a separate draw call for each plank.
 for(let y=lower+.10;y<eave-.08;y+=.19){batch.box('boards',0,y,front+.035,w+.02,.174,.12);batch.box('boards',0,y,-front-.035,w+.02,.174,.12);for(const side of[-1,1])batch.box('boards',side*(half+.035),y,0,.12,.174,d);}
 for(const side of[-1,1])for(const z of[-front-.06,front+.06])batch.box('timber',side*(half-.10),eave/2,z,.18,eave,.19);
 batch.box('timber',0,lower-.03,front+.12,w+.25,.22,.19);batch.box('timber',0,eave-.05,front+.12,w+.25,.20,.20);
 // Gables are enclosed, with narrow timber siding and a loft window.
 const gableRise=(half+1.12)*Math.tan(pitch),ridge=eave+gableRise;
 for(const z of[-front-.02,front+.02]){const shape=new T.Shape();shape.moveTo(-half,eave);shape.lineTo(0,ridge-.1);shape.lineTo(half,eave);shape.closePath();const geo=new T.ShapeGeometry(shape);if(z<0)geo.rotateY(Math.PI);batch.add('boards',geo,0,0,z);for(let y=eave+.16;y<ridge-.18;y+=.22){const ww=w*(1-(y-eave)/(gableRise-.1));if(ww>.2)batch.box('trim',0,y,z+(z>0?.025:-.025),ww,.025,.035);}batch.beam('timber',[-half,eave,z+.05],[0,ridge-.03,z+.05],.065);batch.beam('timber',[0,ridge-.03,z+.05],[half,eave,z+.05],.065);}
 const roofTop=roof(batch,w,d,eave,pitch,rnd,variant);
 // Main entrance and its shadowed reveal, a glazed upper panel and handle.
 batch.box('recess',0,1.17,front+.065,1.62,2.43,.21);batch.box('shutter',0,1.15,front+.19,1.35,2.28,.11);
 for(const x of[-.74,.74])batch.box('trim',x,1.20,front+.28,.11,2.52,.18);batch.box('trim',0,2.43,front+.28,1.59,.14,.18);
 for(let k=0;k<6;k++)batch.box('trim',-.54+k*.216,1.11,front+.255,.022,2.11,.035);
 batch.box('glass',0,1.86,front+.278,.68,.54,.025);batch.box('metal',.46,1.10,front+.32,.035,.19,.07);
 batch.box('stone',0,-.06,front+.77,2.35,.18,1.45);
 for(let j=0;j<3;j++)batch.box('stone',0,-.15-j*.15,front+1.35+j*.30,2.05,.17,.35);
 // Small porch roof with brackets rather than a flat slab pasted to a wall.
 batch.box('roof',0,2.72,front+.82,2.6,.11,1.8,[-.12,0,0],variant%3===0?'#7b8580':'#9b7459');
 for(const x of[-1.12,1.12])batch.beam('timber',[x,2.00,front+.10],[x,2.63,front+.94],.065);
 const windowXs=w>13?[-w*.35,-w*.17,w*.17,w*.35]:[-w*.29,w*.29];
 for(const x of windowXs)windowAt(batch,x,1.86,front+.04,{rnd,flowers:true,large:lodge});
 for(const x of windowXs)windowAt(batch,x,lower+1.42,front+.09,{rnd,flowers:false,large:lodge});
 for(const z of[-d*.28,d*.24])windowAt(batch,z,1.84,half+.04,{side:true,rnd,flowers:false});
 for(const z of[-d*.27,d*.25])windowAt(batch,z,lower+1.35,half+.09,{side:true,rnd,flowers:false});
 windowAt(batch,0,eave+gableRise*.40,front+.04,{rnd,large:false,flowers:false});
 // Continuous front balcony with substantial supports, closely spaced
 // balusters and a handrail; the entrance remains unobstructed below it.
 const balconyWidth=w+.62,balconyDepth=lodge?2.5:1.85,bz=front+balconyDepth*.5+.1,railZ=front+balconyDepth;
 batch.box('timber',0,lower-.11,bz,balconyWidth,.22,balconyDepth);
 for(let i=0;i<Math.ceil(balconyWidth/.27);i++){const x=-balconyWidth/2+.13+i*.27;batch.box('trim',x,lower+.025,bz,.245,.065,balconyDepth-.05);}
 const posts=Math.ceil(balconyWidth/.43);
 for(let i=0;i<=posts;i++){const x=-balconyWidth/2+i*balconyWidth/posts;batch.box(i%4===0?'timber':'boards',x,lower+.57,railZ,.09,i%4===0?1.2:1.02,.11);}
 batch.box('trim',0,lower+1.16,railZ,balconyWidth+.15,.12,.18);batch.box('timber',0,lower+.18,railZ,balconyWidth,.095,.11);
 for(const side of[-1,1]){batch.box('trim',side*balconyWidth/2,lower+1.16,bz,.13,.12,balconyDepth);for(let i=0;i<4;i++)batch.box('boards',side*balconyWidth/2,lower+.59,front+.2+i*balconyDepth/4,.10,1.03,.09);batch.beam('timber',[side*w*.36,lower-.14,front+balconyDepth*.75],[side*w*.36,lower-1.20,front+.07],.085);}
 for(const side of[-1,1]){const x=side*w*.28;batch.box('boards',x,lower+.60,railZ+.16,1.65,.32,.42);batch.box('recess',x,lower+.78,railZ+.16,1.52,.04,.31);for(let k=0;k<8;k++)plant(batch,x+(k/7-.5)*1.44,lower+.87,railZ+.18+(rnd()-.5)*.16,rnd,.24,rnd()<.35?'#e0bdaf':'#c96263');}
 // Chimney flue sits above the roof plane, with a stone cap and metal hood.
 const chimneyX=-w*.29,chimneyZ=-d*.22,roofAt=ridge-Math.abs(chimneyX)*Math.tan(pitch),chimneyH=1.55;
 batch.box('stone',chimneyX,roofAt+chimneyH*.35,chimneyZ,.76,chimneyH,.70);batch.box('stone',chimneyX,roofAt+chimneyH*.91,chimneyZ,.94,.15,.87);batch.box('recess',chimneyX,roofAt+chimneyH,chimneyZ,.49,.12,.45);batch.box('metal',chimneyX,roofAt+chimneyH+ .20,chimneyZ,1.01,.10,.91);for(const sx of[-1,1])for(const sz of[-1,1])batch.beam('metal',[chimneyX+sx*.33,roofAt+chimneyH*.94,chimneyZ+sz*.29],[chimneyX+sx*.33,roofAt+chimneyH+.16,chimneyZ+sz*.29],.014);
 // Roof snow guards, gutters and a downpipe communicate construction scale.
 for(const side of[-1,1]){batch.beam('metal',[side*(half+1.08),eave-.04,-d/2-.94],[side*(half+1.08),eave-.04,d/2+.94],.055);batch.beam('metal',[side*(half+.12),eave-.05,-front-.08],[side*(half+.12),.15,-front-.08],.035);}
 // Entrance lantern and honest small-scale village props.
 const lampX=1.16;batch.box('metal',lampX,2.03,front+.35,.21,.46,.21);batch.box('lamp',lampX,2.03,front+.375,.15,.29,.18);batch.box('metal',lampX,2.29,front+.35,.29,.075,.29);
 barrel(batch,-half-.61,Math.min(0,groundCorners[3]||0),front-.72,rnd);if(lodge)barrel(batch,-half-1.31,Math.min(0,groundCorners[3]||0),front-.65,rnd);
 const woodZ=-d*.30;
 for(let row=0;row<3;row++)for(let col=0;col<5-row;col++){const x=half+.33+row*.02,y=.14+row*.23,z=woodZ+(col-(4-row)/2)*.24;const log=new T.CylinderGeometry(.105,.12,.83,7);log.rotateZ(Math.PI/2);batch.add('boards',log,x,y,z,[0,(rnd()-.5)*.1,0]);const cut=new T.CircleGeometry(.10,7);cut.rotateY(Math.PI/2);batch.add('trim',cut,x+.425,y,z);}
 if(lodge){
  const tx=-half-2.5,tz=d*.15,tw=4.4,td=d*.72;batch.box('timber',tx,.14,tz,tw,.28,td);for(let x=tx-tw/2+.2;x<tx+tw/2;x+=.28)batch.box('trim',x,.30,tz,.25,.055,td);
  for(const z of[tz-td/2,tz+td/2]){batch.box('trim',tx,1.37,z,tw,.12,.14);for(let x=tx-tw/2;x<=tx+tw/2+.01;x+=.52)batch.box('boards',x,.86,z,.09,1.03,.09);}
  // A low picnic table and two benches on the lodge terrace.
  batch.box('boards',tx,.99,tz,2.40,.13,.86);for(const z of[tz-.84,tz+.84])batch.box('boards',tx,.64,z,2.55,.14,.34);for(const x of[tx-.79,tx+.79]){batch.beam('timber',[x,.3,tz-.8],[x,.95,tz+.3],.065);batch.beam('timber',[x,.3,tz+.8],[x,.95,tz-.3],.065);}
 }
 const triangles=batch.finish(group),assetBounds=new T.Box3().setFromObject(group),height=Math.max(roofTop,roofAt+chimneyH+.25,assetBounds.max.y);
 group.userData={asset:'yunxiu-swiss-chalet',seed,width:w,depth:d,lodge,triangles,drawCalls:group.children.length,chimney:[chimneyX,roofAt+chimneyH+.35,chimneyZ],groundCorners:[...groundCorners],bounds:{min:assetBounds.min.toArray(),max:assetBounds.max.toArray()}};
 return{group,footprint:{halfWidth:half+(lodge?4.9:1.25),halfDepth:front+Math.max(2.65,balconyDepth+.65),height},entry:[0,0,front+Math.max(2.65,balconyDepth+.65)+.75],floorHeight:0};
}
