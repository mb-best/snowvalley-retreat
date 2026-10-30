import * as T from '../vendor/three.module.js';
import {ALT_BASE,MIN_X,MAX_X,MIN_Z,MAX_Z,clamp,mix,smooth,hash,Spatial,segment} from './core.js';
import {silhouette,crossTree} from './foliage.js?v=horizon-2';
import {treeModels} from './assets.js';

const TAU=Math.PI*2,PERIMETER=72000,SEGMENTS=1440;
export const RINGS=[0,12.5,25,50,100,175,275,400,550,750,1000,1300,1650,2050,2500,3000,3600,4300,5100,6000,7000,8200,9600,11200,13000,15100,17500,20200,23300,26900,31000,35700,41100,47300,54400,62600,72000,83000,96000,112000,132000,156000],SEAM_STEPS=5;
const WRAP=x=>((x%1)+1)%1;
const wave=(a,seed=0)=>Math.sin(a*3+seed)*.43+Math.sin(a*7+seed*2.1)*.27+Math.sin(a*17-seed)*.17+Math.sin(a*41+seed)*.09+Math.sin(a*97-seed)*.04;
// Isotropic world-space noise: never stretch a tiny texture over widening rings.
const noise=(x,z,seed=0)=>{const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return mix(mix(hash(i,j,seed),hash(i+1,j,seed),u),mix(hash(i,j+1,seed),hash(i+1,j+1,seed),u),v);};

// The perimeter uses the very same 50 m vertices as the authored terrain.
// Only rendering calls this model: it never enters Geography or navigation.
export function perimeterPoint(u){
 const d=WRAP(u)*PERIMETER;
 if(d<20000)return[MIN_X+d,MIN_Z];
 if(d<36000)return[MAX_X,MIN_Z+d-20000];
 if(d<56000)return[MAX_X-(d-36000),MAX_Z];
 return[MIN_X,MAX_Z-(d-56000)];
}

export class HorizonModel{
 constructor(geo){
  this.geo=geo;
  this.border=Array.from({length:SEGMENTS},(_,i)=>{
   const [x,z]=perimeterPoint(i/SEGMENTS),h=geo.height(x,z),sx=x===MIN_X?-1:x===MAX_X?1:0,sz=z===MIN_Z?-1:z===MAX_Z?1:0;
   const dx=sx?(h-geo.height(x-sx*100,z))/100:0,dz=sz?(h-geo.height(x,z-sz*100))/100:0;
   const e=geo.ecological(x-sx*60,z-sz*60);
   return{x,z,h,dx:clamp(dx,-.8,.8),dz:clamp(dz,-.8,.8),forest:clamp(e.tree*1.6+(e.forest?.3:0),0,1)};
  });
  this.profiles=Array.from({length:720},(_,i)=>{
   const a=i/720*TAU-Math.PI,x=Math.sin(a),z=Math.cos(a),r=1/Math.max(Math.abs(x)/MAX_X,Math.abs(z)/MAX_Z),bx=x*r,bz=z*r;
   // Filter the broad landform, retaining low valley outlets in each direction.
   let h=0;for(const offset of[-320,-160,0,160,320])h+=geo.height(clamp(bx+z*offset,MIN_X,MAX_X),clamp(bz-x*offset,MIN_Z,MAX_Z))/5;
   return h;
  });
  const profiles=this.profiles;this.profiles=profiles.map((_,i)=>{
   let h=0,w=0;for(let j=-18;j<=18;j++){const weight=Math.exp(-.5*(j/7)**2);h+=profiles[(i+j+720)%720]*weight;w+=weight;}return h/w;
  });
  // Pre-filter each edge at increasing physical scales. As the eye moves above
  // the boundary, ridges become broad foothills instead of radial curtains.
  this.edges=[
   {axis:'x',fixed:MIN_Z,start:MIN_X,count:401,nx:0,nz:-1},
   {axis:'z',fixed:MAX_X,start:MIN_Z,count:321,nx:1,nz:0},
   {axis:'x',fixed:MAX_Z,start:MIN_X,count:401,nx:0,nz:1},
   {axis:'z',fixed:MIN_X,start:MIN_Z,count:321,nx:-1,nz:0}
  ].map(edge=>{
   const raw=Array.from({length:edge.count},(_,i)=>{
    const t=edge.start+i*50,x=edge.axis==='x'?t:edge.fixed,z=edge.axis==='z'?t:edge.fixed,h=geo.height(x,z);
    return{h,slope:(h-geo.height(x-edge.nx*50,z-edge.nz*50))/50};
   });
   const levels=[0,100,250,500,1000,2000,4000].map(radius=>raw.map((_,i)=>{
    if(!radius)return raw[i];let h=0,slope=0,w=0;
    for(let j=Math.max(0,i-Math.ceil(radius*2/50));j<=Math.min(raw.length-1,i+Math.ceil(radius*2/50));j++){
     const weight=Math.exp(-.5*((j-i)*50/radius)**2);h+=raw[j].h*weight;slope+=raw[j].slope*weight;w+=weight;
    }return{h:h/w,slope:slope/w};
   }));return{...edge,levels};
  });
  this.rivers=[];this.riverIndex=new Spatial(500);
  for(const path of geo.paths.filter(p=>p.feature.type==='river')){
   const points=path.points,end=points.at(-1);
   if(Math.min(Math.abs(end[0]-MIN_X),Math.abs(end[0]-MAX_X),Math.abs(end[1]-MIN_Z),Math.abs(end[1]-MAX_Z))>.1)continue;
   const previous=points.at(-2),nx=end[0]<MIN_X+.1?-1:end[0]>MAX_X-.1?1:0,nz=end[1]<MIN_Z+.1?-1:end[1]>MAX_Z-.1?1:0;
   const dx=end[0]-previous[0],dz=end[1]-previous[1],length=Math.hypot(dx,dz)||1;
   let ux=nx+dx/length*.10,uz=nz+dz/length*.10,unit=Math.hypot(ux,uz);ux/=unit;uz/=unit;
   const water=geo.waterAt(end[0]-nx*.02,end[1]-nz*.02),level=water?.height??geo.height(...end)+.22;
   const river={name:path.feature.name,width:path.feature.width||25,points:[]},seed=this.rivers.length*1.91;
   for(let i=0;i<=140;i++){
    const d=i*100,bend=(1-Math.exp(-d/900))*Math.sin(d/950+seed)*95;
    river.points.push({x:end[0]+ux*d-uz*bend,z:end[1]+uz*d+ux*bend,level:level-d*.009,width:river.width*(1+d/10000),distance:d});
   }
   for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],pad=3800;
    this.riverIndex.add({a,b,river},[Math.min(a.x,b.x)-pad,Math.min(a.z,b.z)-pad,Math.max(a.x,b.x)+pad,Math.max(a.z,b.z)+pad]);
   }
   this.rivers.push(river);
  }
 }
 regional(angle){const f=WRAP((angle+Math.PI)/TAU)*this.profiles.length,i=Math.floor(f);return mix(this.profiles[i],this.profiles[(i+1)%this.profiles.length],f-i);}
 edge(index,t,d){
  const e=this.edges[index],f=clamp((t-e.start)/50,0,e.count-1),i=Math.min(e.count-2,Math.floor(f)),u=f-i;
  const radii=[0,100,250,500,1000,2000,4000],radius=Math.min(4000,d*d/(d+600)*.55);
  let l=0;while(l<radii.length-2&&radius>radii[l+1])l++;
  const weight=smooth(radii[l],radii[l+1],radius),sample=(level,key)=>mix(e.levels[level][i][key],e.levels[level][i+1][key],u);
  const h=mix(sample(l,'h'),sample(l+1,'h'),weight),slope=mix(sample(l,'slope'),sample(l+1,'slope'),weight);
  // Preserve the actual inward slope at the join. Very steep authored slopes
  // lose their inclination sooner, so their continuation cannot grow a wall.
  const reach=1600/(1+Math.abs(slope)*.9);
  return h+slope*reach*(1-Math.exp(-d/reach));
 }
 height(x,z){
  const bx=clamp(x,MIN_X,MAX_X),bz=clamp(z,MIN_Z,MAX_Z),ox=x-bx,oz=z-bz,d=Math.hypot(ox,oz);
  if(d===0)return this.geo.height(x,z);
  const ex=ox?this.edge(ox>0?1:3,bz,Math.abs(ox)):0,ez=oz?this.edge(oz>0?2:0,bx,Math.abs(oz)):0;
  const extension=ox&&oz?ex+ez-this.geo.height(bx,bz):ox?ex:ez;
  const a=Math.atan2(x,z),regional=this.regional(a),upland=smooth(950,2400,regional);
  const warpedX=x/7500+(noise(x/19000,z/19000,5)-.5)*2.2,warpedZ=z/7500+(noise(x/21000,z/21000,8)-.5)*2.2;
  const broad=noise(warpedX,warpedZ,17),ridge=1-Math.abs(2*noise(warpedX*1.9,warpedZ*1.9,31)-1);
  const distant=regional*.56+180+(380+upland*2100)*(.58*broad+.42*ridge)+noise(x/2200,z/2200,41)*150;
  let y=mix(extension,distant,smooth(1200,14500,d))-d*d/(2*6371000);
  // Evaluate each river once at its closest segment. Repeatedly carving the
  // same point with every segment in a cell produces artificial narrow slots.
  const channels=new Map();
  for(const {a,b,river} of this.riverIndex.at(x,z)){
   const nearest=segment([x,z],[a.x,a.z],[b.x,b.z]);
   if(!channels.has(river)||nearest.distance<channels.get(river).distance)channels.set(river,{...nearest,a,b});
  }
  let channelWeight=0,channelLevel=0,influence=0;
  for(const {a,b,t,distance}of channels.values()){
   const along=mix(a.distance,b.distance,t),level=mix(a.level,b.level,t),relief=y-level+2.4,width=Math.min(3800,1000+along*.12+Math.max(0,relief)*.7),floor=Math.min(900,80+along*.085);
   // A floodplain grows with distance as the terrain LOD becomes coarser.
   // The water stays above ground without needing an unresolved razor trench.
   const strength=(1-smooth(floor,width,distance))*smooth(0,Math.max(120,distance*1.6),d)*(1-smooth(10500,14000,along));
   const weight=strength*(80/(80+distance))**4;
   channelWeight+=weight;channelLevel+=(level-2.4)*weight;influence=Math.max(influence,strength);
  }
  if(channelWeight>0)y=mix(y,channelLevel/channelWeight,influence);
  return y;
 }
 normal(x,z){
  const step=25,bx=clamp(x,MIN_X,MAX_X),bz=clamp(z,MIN_Z,MAX_Z);
  // Common one-sided derivatives on both meshes at the exact frozen edge.
  if(x>=MIN_X&&x<=MAX_X&&z>=MIN_Z&&z<=MAX_Z){
   const ax=clamp(bx-step,MIN_X,MAX_X),cx=clamp(bx+step,MIN_X,MAX_X),az=clamp(bz-step,MIN_Z,MAX_Z),cz=clamp(bz+step,MIN_Z,MAX_Z);
   return new T.Vector3(-(this.geo.height(cx,bz)-this.geo.height(ax,bz))/(cx-ax),1,-(this.geo.height(bx,cz)-this.geo.height(bx,az))/(cz-az)).normalize();
  }
  return new T.Vector3(-(this.height(x+step,z)-this.height(x-step,z))/(step*2),1,-(this.height(x,z+step)-this.height(x,z-step))/(step*2)).normalize();
 }
 at(u,distance){
  const f=WRAP(u)*SEGMENTS,i=Math.floor(f),b=this.border[i],c=this.border[(i+1)%SEGMENTS],t=f-i;
  const x=mix(b.x,c.x,t)*(1+distance/MAX_X),z=mix(b.z,c.z,t)*(1+distance/MAX_Z),bx=clamp(x,MIN_X,MAX_X),bz=clamp(z,MIN_Z,MAX_Z);
  // Tangential positions drift along a side as successive rings widen. Sample
  // that actual nearest edge, rather than extruding a repeated mountain wall.
  const d=Math.hypot(x-bx,z-bz),y=this.height(x,z);
  return{x,z,y,d,forest:mix(b.forest,c.forest,t),altitude:y+ALT_BASE};
 }
 ridge(angle,layer){const h=this.regional(angle),upland=smooth(1050,2300,h),r=Math.pow(.5+.5*wave(angle,2.2+layer*1.73),1.45);return 1900+h*.38+(650+upland*3000+layer*300)*r;}
}

function dataTexture(bytes,width,height){const t=new T.DataTexture(bytes,width,height,T.RGBAFormat);t.wrapS=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}

export class DistantLandscape{
 constructor(land){
  this.land=land;this.model=new HorizonModel(land.geo);this.eye={value:new T.Vector3()};
  this.group=new T.Group();this.group.name='Boundary scenery · visual only';this.group.userData.visualOnly=true;
  this.makeApron();this.matchBoundaryNormals();this.makeRivers();this.makePanoramas();this.makeForest();land.scene.add(this.group);
 }
 makeApron(){
  const n=SEGMENTS+1,p=[],uv=[],outside=[],indices=[],forest=[],normals=[];
  const append=(u,d)=>{
   const q=this.model.at(u,d),normal=this.model.normal(q.x,q.z);
   p.push(q.x,q.y,q.z);uv.push(u,d/156000);outside.push(q.d);forest.push(q.forest);normals.push(normal.x,normal.y,normal.z);
  };
  for(let j=0;j<RINGS.length;j++)for(let i=0;i<=SEGMENTS;i++){
   append(i/SEGMENTS,RINGS[j]);
   if(j>0&&j<RINGS.length-1&&i<SEGMENTS){const k=j*n+i;indices.push(k,k+1,k+n,k+1,k+n+1,k+n);}
  }
  // A fine 10 m inner ribbon meets the hydraulic terrain tiles. A triangle fan
  // joins it to the first coarse ring without a crack or overlapping ground.
  const seamOffset=p.length/3;
  for(let i=0;i<=SEGMENTS*SEAM_STEPS;i++)append(i/(SEGMENTS*SEAM_STEPS),0);
  for(let i=0;i<SEGMENTS;i++){
   const inner=seamOffset+i*SEAM_STEPS,outer=n+i;
   for(let k=0;k<SEAM_STEPS;k++)indices.push(inner+k,inner+k+1,outer);
   indices.push(inner+SEAM_STEPS,outer+1,outer);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('exteriorDistance',new T.Float32BufferAttribute(outside,1));g.setIndex(indices);
  g.setAttribute('exteriorForest',new T.Float32BufferAttribute(forest,1));
  const material=this.land.terrainMat.clone(),original=this.land.terrainMat.onBeforeCompile;
  // Solid ground writes depth in the same pass as the playable terrain.
  // A transparent, shortened-fog apron showed as a separate sheet from above.
  material.transparent=false;material.side=T.FrontSide;
  material.onBeforeCompile=s=>{
   original(s);
   s.vertexShader='attribute float exteriorDistance,exteriorForest;varying float vExterior,vForest;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvExterior=exteriorDistance;vForest=exteriorForest;');
   s.fragmentShader='varying float vExterior,vForest;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace(/if\(\(uSurfaceMode<\.5[\s\S]*?\)discard;/,'').replace('if(abs(vGround.x-uObserver.x)<63.8&&abs(vGround.z-uObserver.z)<63.8)discard;','');
   // Riverbed textures are clamped inside the map; suppress that last texel
   // outside, where actual exterior channels provide the water/ground relief.
   s.fragmentShader=s.fragmentShader.replace('.r;vec3 gravel', '.r*(1.-smoothstep(0.,90.,vExterior));vec3 gravel');
   s.fragmentShader=s.fragmentShader.replace('diffuseColor.rgb*=c;',`float canopy=vForest*smoothstep(.26,.72,ns(vGround.xz*.009)+ns(vGround.xz*.024)*.18);
    canopy*=smoothstep(25.,1800.,vExterior)*(1.-smoothstep(3100.,3500.,h))*(1.-snow);
    c*=mix(vec3(1.),vec3(.70,.82,.73),canopy*.55);diffuseColor.rgb*=c;`);
  };
  material.customProgramCacheKey=()=> 'yunxiu-distant-apron-2';
  this.apron=new T.Mesh(g,material);this.apron.name='Edge-matched textured terrain';this.apron.receiveShadow=false;this.group.add(this.apron);
 }
 matchBoundaryNormals(){
  for(const mesh of[this.land.terrain,this.land.groundChanges?.hydroMesh]){
   if(!mesh)continue;const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);if(x!==MIN_X&&x!==MAX_X&&z!==MIN_Z&&z!==MAX_Z)continue;
    const normal=this.model.normal(x,z);n.setXYZ(i,normal.x,normal.y,normal.z);
   }n.needsUpdate=true;
  }
  if(this.land.boundarySkirt)this.land.boundarySkirt.visible=false;
 }
 matchNearNormals(){
  const near=this.land.near;if(!near)return;
  const p=near.geometry.attributes.position,n=near.geometry.attributes.normal;
  if(Math.abs(near.position.x)<MAX_X-90&&Math.abs(near.position.z)<MAX_Z-90)return;
  for(let i=0;i<p.count;i++){
   const x=near.position.x+p.getX(i),z=near.position.z+p.getZ(i);
   if(Math.min(Math.abs(Math.abs(x)-MAX_X),Math.abs(Math.abs(z)-MAX_Z))>25)continue;
   const normal=this.model.normal(clamp(x,MIN_X,MAX_X),clamp(z,MIN_Z,MAX_Z));n.setXYZ(i,normal.x,normal.y,normal.z);
  }n.needsUpdate=true;
 }
 forestAt(x,z){
  const bx=clamp(x,MIN_X,MAX_X),bz=clamp(z,MIN_Z,MAX_Z),e=this.land.geo.ecological(bx,bz),y=this.model.height(x,z),altitude=y+ALT_BASE;
  let tree=e.tree*(1-smooth(e.forestLine-120,e.forestLine,altitude));
  if(tree>.01)for(const {a,b,river}of this.model.riverIndex.at(x,z))if(segment([x,z],[a.x,a.z],[b.x,b.z]).distance<river.width*.7+5){tree=0;break;}
  return{tree,y,altitude,forestLine:e.forestLine,bx,bz};
 }
 makeForest(){
  this.forestMeshes=[];this.detailTrees=new Map();this.lastForest=new T.Vector3(1e8,0,1e8);
  if(typeof document==='undefined'||!this.land.assets?.batch)return;
  const rows=[[],[]],step=this.land.quality==='low'?100:76;
  for(let z=MIN_Z-3500;z<MAX_Z+3500;z+=step)for(let x=MIN_X-3500;x<MAX_X+3500;x+=step){
   if(x>MIN_X-step&&x<MAX_X+step&&z>MIN_Z-step&&z<MAX_Z+step)continue;
   const xx=x+(hash(x,z,3)-.5)*step*.8,zz=z+(hash(z,x,5)-.5)*step*.8;
   if(xx>=MIN_X&&xx<=MAX_X&&zz>=MIN_Z&&zz<=MAX_Z)continue;
   const e=this.forestAt(xx,zz);if(e.tree<.08||hash(x,z,91)>e.tree*.83)continue;
   const species=this.land.geo.speciesAt(e.bx,e.bz,hash(x,z,2)),broad=['broadleaf','birch'].includes(species),height=(broad?13:18)*(.65+hash(x,z,12)*.6)*(.45+.55*smooth(0,300,e.forestLine-e.altitude));
   rows[broad?1:0].push({x:xx,z:zz,y:e.y,height,angle:hash(x,z,50)*TAU});
  }
  const dummy=new T.Object3D();
  this.forestMeshes=rows.map((rows,i)=>{
   const m=new T.MeshLambertMaterial({map:silhouette(!!i),alphaTest:.48,side:T.DoubleSide,color:'#c6d8bc'});
   m.onBeforeCompile=s=>{
    s.uniforms.uExteriorEye=this.eye;s.vertexShader='uniform vec3 uExteriorEye;varying float vTreeRange;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTreeRange=length(instanceMatrix[3].xyz-uExteriorEye);');
    s.fragmentShader='varying float vTreeRange;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(vTreeRange<260.)discard;');
   };m.customProgramCacheKey=()=> 'yunxiu-exterior-forest-2';
   const mesh=new T.InstancedMesh(crossTree(),m,rows.length);
   rows.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.height*.52,p.height,p.height*.52);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
   mesh.frustumCulled=false;this.group.add(mesh);return mesh;
  });
  for(const [species,name]of Object.entries(treeModels)){
   const batch=this.land.assets.batch(name,500,{shadow:false});this.detailTrees.set(species,batch);this.group.add(batch.group);
  }
 }
 updateForest(camera){
  if(!this.detailTrees.size||camera.position.distanceToSquared(this.lastForest)<900)return;
  const eye=camera.position;this.lastForest.copy(eye);
  const edgeDistance=Math.min(MAX_X-Math.abs(eye.x),MAX_Z-Math.abs(eye.z));
  for(const batch of this.detailTrees.values())batch.group.visible=edgeDistance<300&&eye.y-this.land.geo.height(clamp(eye.x,MIN_X,MAX_X),clamp(eye.z,MIN_Z,MAX_Z))<300;
  if(edgeDistance>300||eye.y-this.land.geo.height(clamp(eye.x,MIN_X,MAX_X),clamp(eye.z,MIN_Z,MAX_Z))>300)return;
  const rows=new Map([...this.detailTrees.keys()].map(k=>[k,[]])),step=this.land.quality==='low'?17:12,cx=Math.floor(eye.x/step)*step,cz=Math.floor(eye.z/step)*step;
  for(let z=cz-275;z<=cz+275;z+=step)for(let x=cx-275;x<=cx+275;x+=step){
   const xx=x+(hash(x,z,7)-.5)*step*.85,zz=z+(hash(x,z,8)-.5)*step*.85;
   if(xx>=MIN_X&&xx<=MAX_X&&zz>=MIN_Z&&zz<=MAX_Z||Math.hypot(xx-eye.x,zz-eye.z)>260)continue;
   const e=this.forestAt(xx,zz);if(hash(x,z,15)>=e.tree*.9)continue;
   const species=this.land.geo.speciesAt(e.bx,e.bz,hash(x,z,24)),height=(species==='birch'?13:species==='broadleaf'?14:species==='pine-small'?8:species==='juniper'?1.3:19)*(.72+hash(x,z,19)*.5)*(.48+.52*smooth(0,260,e.forestLine-e.altitude));
   rows.get(species).push({x:xx,z:zz,y:e.y,height,angle:hash(x,z,4)*TAU,wide:.8+hash(x,z,6)*.4});
  }for(const[species,list]of rows)this.detailTrees.get(species).set(list);
 }
 makeRivers(){
  this.riverMeshes=[];
  for(const river of this.model.rivers){
   const p=[],uv=[],indices=[];
   for(let i=0;i<river.points.length;i++){
    const q=river.points[i],a=river.points[Math.max(0,i-1)],b=river.points[Math.min(river.points.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    for(const sign of[-1,1]){p.push(q.x-dz/length*q.width/2*sign,q.level+.015,q.z+dx/length*q.width/2*sign);uv.push((sign+1)/2,q.distance/14000);}
    if(i<river.points.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
   const m=this.land.waterMaterial?this.land.waterMaterial():new T.MeshStandardMaterial({color:'#75b8b2',transparent:true,opacity:.88});
   const hook=m.onBeforeCompile;m.onBeforeCompile=s=>{
    hook(s);s.vertexShader='varying vec2 vDistantRiver;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDistantRiver=uv;');
    s.fragmentShader='varying vec2 vDistantRiver;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=1.-smoothstep(.65,1.,vDistantRiver.y);');
   };m.customProgramCacheKey=()=> 'yunxiu-distant-river-1';m.side=T.DoubleSide;m.forceSinglePass=true;
   const water=new T.Mesh(g,m);water.name='River beyond boundary · '+river.name;water.renderOrder=2;this.group.add(water);this.riverMeshes.push(water);
  }
 }
 makePanoramas(){
  const width=this.land.quality==='low'?2048:4096,height=256,low=-5000,high=10500;
  this.panoramas=[];
  for(let layer=0;layer<3;layer++){
   const bytes=new Uint8Array(width*height*4);
   for(let x=0;x<width;x++){
    const a=x/width*TAU-Math.PI,top=this.model.ridge(a,layer),left=this.model.ridge(a-TAU/width,layer),right=this.model.ridge(a+TAU/width,layer),face=clamp((left-right)*.006,-.23,.23);
    for(let y=0;y<height;y++){
     const altitude=mix(low,high,y/(height-1)),k=(y*width+x)*4,n=hash(x%width,y,layer+12),rock=smooth(2850,4500,altitude),snow=smooth(4450+Math.sin(a*37)*170,4900+Math.sin(a*37)*170,altitude),gully=Math.sin(a*310+altitude*.0018)*.035;
     const base=[mix(.27,.48,rock),mix(.39,.51,rock),mix(.29,.50,rock)];
     for(let c=0;c<3;c++)bytes[k+c]=Math.round(255*clamp(mix(base[c]*(.91+face+gully+n*.07),[.83,.89,.93][c],snow),0,1));
     bytes[k+3]=Math.round(255*(1-smooth(top-35,top+35,altitude)));
    }
   }
   this.panoramas.push(dataTexture(bytes,width,height));
  }
 }
 configureSky(material){
  material.uniforms.uHorizonEye=this.eye;material.uniforms.uHorizonSeason=this.land.season;
  material.uniforms.uHorizonFog={value:this.land.scene.fog?.color||new T.Color('#adc8cf')};
  this.panoramas.forEach((map,i)=>material.uniforms['uHorizon'+i]={value:map});
  const functions=`
   uniform sampler2D uHorizon0,uHorizon1,uHorizon2;
   uniform vec3 uHorizonEye,uHorizonFog;uniform float uHorizonSeason;
   vec3 horizonLayer(vec3 sky,vec3 ray,sampler2D panorama,float radius,float haze){
    vec2 direction=normalize(ray.xz);float b=dot(uHorizonEye.xz,direction);
    float distance=-b+sqrt(max(1.,b*b+radius*radius-dot(uHorizonEye.xz,uHorizonEye.xz)));
    vec2 hit=uHorizonEye.xz+direction*distance;
    float altitude=uHorizonEye.y+1700.+ray.y/max(length(ray.xz),.0001)*distance+distance*distance/(2.*6371000.);
    float u=atan(hit.x,hit.y)/6.28318530718+.5,v=(altitude+5000.)/15500.;
    vec4 terrain=texture2D(panorama,vec2(u,clamp(v,0.,1.)));
    float winter=smoothstep(2.35,2.9,uHorizonSeason),snow=smoothstep(2900.,3400.,altitude)*winter;
    vec3 color=mix(terrain.rgb,vec3(.83,.88,.91),snow*.8);
    color=mix(color*.12,color,uDay);
    vec3 atmosphere=mix(vec3(.09,.14,.21),vec3(.70,.82,.85),uDay);
    color=mix(color,atmosphere,haze);
    float weather=1.-smoothstep(.35,1.,uCloud)*.85;
    return mix(sky,color,terrain.a*step(v,1.)*weather);
   }
  `;
  material.fragmentShader=material.fragmentShader.replace('void main()',functions+'void main()');
  // The shader draws a directional panorama, so it has no finite billboard
  // edges. Radius and eye altitude give correct horizons while flying.
  material.fragmentShader=material.fragmentShader.replace('gl_FragColor=vec4(c,1.);',`
   if(length(d.xz)>.001){
    c=horizonLayer(c,d,uHorizon2,300000.,.84);
    c=horizonLayer(c,d,uHorizon1,180000.,.73);
    c=horizonLayer(c,d,uHorizon0,110000.,.61);
   }
   gl_FragColor=vec4(c,1.);`);
  material.fragmentShader=material.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
   gl_FragColor.rgb=mix(gl_FragColor.rgb,uHorizonFog,1.-smoothstep(0.,.10,d.y));`);
  material.needsUpdate=true;
  if(this.land.sky)this.land.sky.onBeforeRender=(_renderer,_scene,camera)=>this.update(camera);
 }
 update(camera){this.eye.value.copy(camera.position);this.updateForest(camera);}
 dispose(){this.group.removeFromParent();for(const m of[this.apron,...this.riverMeshes,...this.forestMeshes]){m.geometry.dispose();m.material.map?.dispose();m.material.dispose();}this.panoramas.forEach(t=>t.dispose());}
}
