import * as T from '../vendor/three.module.js';
import {ALT_BASE,MIN_X,MAX_X,MIN_Z,MAX_Z,clamp,mix,smooth,hash,Spatial,segment} from './core.js';

const TAU=Math.PI*2,PERIMETER=72000,SEGMENTS=1440;
const RINGS=[0,40,100,220,450,800,1300,2100,3200,4700,6600,9000,12000,16000,21000,27000,34000,42000,51000,61000,72000,85000];
const WRAP=x=>((x%1)+1)%1;
const wave=(a,seed=0)=>Math.sin(a*3+seed)*.43+Math.sin(a*7+seed*2.1)*.27+Math.sin(a*17-seed)*.17+Math.sin(a*41+seed)*.09+Math.sin(a*97-seed)*.04;

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
  this.rivers=[];this.riverIndex=new Spatial(500);
  for(const path of geo.paths.filter(p=>p.feature.type==='river')){
   const points=path.points,end=points.at(-1);
   if(Math.min(Math.abs(end[0]-MIN_X),Math.abs(end[0]-MAX_X),Math.abs(end[1]-MIN_Z),Math.abs(end[1]-MAX_Z))>.1)continue;
   const previous=points.at(-2),nx=end[0]<MIN_X+.1?-1:end[0]>MAX_X-.1?1:0,nz=end[1]<MIN_Z+.1?-1:end[1]>MAX_Z-.1?1:0;
   const dx=end[0]-previous[0],dz=end[1]-previous[1],length=Math.hypot(dx,dz)||1;
   let ux=nx+dx/length*.55,uz=nz+dz/length*.55,unit=Math.hypot(ux,uz);ux/=unit;uz/=unit;
   const water=geo.waterAt(end[0]-nx*.02,end[1]-nz*.02),level=water?.height??geo.height(...end)+.22;
   const river={name:path.feature.name,width:path.feature.width||25,points:[]},seed=this.rivers.length*1.91;
   for(let i=0;i<=140;i++){
    const d=i*100,bend=(1-Math.exp(-d/900))*Math.sin(d/950+seed)*95;
    river.points.push({x:end[0]+ux*d-uz*bend,z:end[1]+uz*d+ux*bend,level:level-d*.009,width:river.width*(1+d/10000),distance:d});
   }
   for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],pad=420;
    this.riverIndex.add({a,b},[Math.min(a.x,b.x)-pad,Math.min(a.z,b.z)-pad,Math.max(a.x,b.x)+pad,Math.max(a.z,b.z)+pad]);
   }
   this.rivers.push(river);
  }
 }
 regional(angle){const f=WRAP((angle+Math.PI)/TAU)*this.profiles.length,i=Math.floor(f);return mix(this.profiles[i],this.profiles[(i+1)%this.profiles.length],f-i);}
 at(u,distance){
  const f=WRAP(u)*SEGMENTS,i=Math.floor(f),b=this.border[i],c=this.border[(i+1)%SEGMENTS],t=f-i;
  const x=mix(b.x,c.x,t)*(1+distance/MAX_X),z=mix(b.z,c.z,t)*(1+distance/MAX_Z),bx=clamp(x,MIN_X,MAX_X),bz=clamp(z,MIN_Z,MAX_Z);
  // Tangential positions drift along a side as successive rings widen. Sample
  // that actual nearest edge, rather than extruding a repeated mountain wall.
  const h=this.geo.height(bx,bz),ox=x-bx,oz=z-bz,d=Math.hypot(ox,oz),a=Math.atan2(x,z);
  const sx=Math.sign(ox),sz=Math.sign(oz),gx=sx?clamp((h-this.geo.height(bx-sx*100,bz))/100,-.8,.8):0,gz=sz?clamp((h-this.geo.height(bx,bz-sz*100))/100,-.8,.8):0;
  const extension=h+gx*650*(1-Math.exp(-Math.abs(ox)/650))+gz*650*(1-Math.exp(-Math.abs(oz)/650));
  const regional=this.regional(a),upland=smooth(1150,2300,regional),ridge=Math.pow(.5+.5*wave(a+distance/65000,1.7),2);
  const distant=regional*.74+260+(400+upland*2200)*ridge+Math.sin(distance/4700+a*5)*230+Math.sin(x/1700+Math.sin(z/2900))*95;
  let y=mix(extension,distant,smooth(600,6800,d))-d*d/(2*6371000);
  for(const {a,b} of this.riverIndex.at(x,z)){
   const nearest=segment([x,z],[a.x,a.z],[b.x,b.z]),along=mix(a.distance,b.distance,nearest.t),level=mix(a.level,b.level,nearest.t),floor=70+along*.005;
   const carved=mix(level-2.4,y,smooth(floor,floor+260,nearest.distance));
   y=mix(y,Math.min(y,carved),smooth(0,120,d)*(1-smooth(10500,14000,along)));
  }
  return{x,z,y,d,forest:mix(b.forest,c.forest,t),altitude:y+ALT_BASE};
 }
 ridge(angle,layer){const h=this.regional(angle),upland=smooth(1050,2300,h),r=Math.pow(.5+.5*wave(angle,2.2+layer*1.73),1.45);return 1900+h*.38+(650+upland*3000+layer*300)*r;}
}

function dataTexture(bytes,width,height){const t=new T.DataTexture(bytes,width,height,T.RGBAFormat);t.wrapS=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;}

export class DistantLandscape{
 constructor(land){
  this.land=land;this.model=new HorizonModel(land.geo);this.eye={value:new T.Vector3()};
  this.group=new T.Group();this.group.name='Boundary scenery · visual only';this.group.userData.visualOnly=true;
  this.makeApron();this.makeRivers();this.makePanoramas();land.scene.add(this.group);
 }
 makeApron(){
  const n=SEGMENTS+1,p=[],uv=[],outside=[],indices=[];
  for(let j=0;j<RINGS.length;j++)for(let i=0;i<=SEGMENTS;i++){
   const q=this.model.at(i/SEGMENTS,RINGS[j]);p.push(q.x,q.y,q.z);uv.push(i/SEGMENTS,j/(RINGS.length-1));outside.push(q.d);
   if(j<RINGS.length-1&&i<SEGMENTS){const k=j*n+i;indices.push(k,k+1,k+n,k+1,k+n+1,k+n);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('exteriorDistance',new T.Float32BufferAttribute(outside,1));g.setIndex(indices);g.computeVertexNormals();
  const texW=this.land.quality==='low'?1024:2048,texH=128,bytes=new Uint8Array(texW*texH*4);
  for(let y=0;y<texH;y++)for(let x=0;x<texW;x++){
   const u=x/texW,f=u*SEGMENTS,i=Math.floor(f),b=this.model.border[i],c=this.model.border[(i+1)%SEGMENTS],forest=mix(b.forest,c.forest,f-i),n1=hash(Math.floor(x/9),Math.floor(y/4),19),n2=hash(x,y,61);
   // Baked canopy clusters and meadow openings, with a periodic horizontal seam.
   const canopy=forest*smooth(.22,.76,n1)*(.74+n2*.26),k=(y*texW+x)*4;
   bytes[k]=Math.round(255*(1-canopy*.34));bytes[k+1]=Math.round(255*(1-canopy*.18));bytes[k+2]=Math.round(255*(1-canopy*.29));bytes[k+3]=255;
  }
  this.biomeTexture=dataTexture(bytes,texW,texH);
  const material=this.land.terrainMat.clone(),original=this.land.terrainMat.onBeforeCompile;
  material.transparent=true;material.side=T.DoubleSide;material.forceSinglePass=true;
  material.onBeforeCompile=s=>{
   original(s);s.uniforms.uDistantBiome={value:this.biomeTexture};
   s.vertexShader='attribute float exteriorDistance;varying float vExterior;varying vec2 vHorizonUV;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvExterior=exteriorDistance;vHorizonUV=uv;');
   s.fragmentShader='varying float vExterior;varying vec2 vHorizonUV;uniform sampler2D uDistantBiome;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace(/if\(\(uSurfaceMode<\.5[\s\S]*?\)discard;/,'').replace('if(abs(vGround.x-uObserver.x)<63.8&&abs(vGround.z-uObserver.z)<63.8)discard;','');
   s.fragmentShader=s.fragmentShader.replace('diffuseColor.rgb*=c;','diffuseColor.rgb*=c;diffuseColor.rgb*=mix(vec3(1.),texture2D(uDistantBiome,vHorizonUV).rgb,smoothstep(90.,1400.,vExterior)*(1.-snow));');
   s.fragmentShader=s.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
    float opticalDepth=mix(vFogDepth,min(vFogDepth,22000.+max(0.,vFogDepth-22000.)*.12),smoothstep(0.,20000.,vExterior));
    float fogFactor=1.-exp(-fogDensity*fogDensity*opticalDepth*opticalDepth);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);
   #endif
   gl_FragColor.a*=1.-smoothstep(51000.,85000.,vExterior);`);
  };
  material.customProgramCacheKey=()=> 'yunxiu-distant-apron-1';
  this.apron=new T.Mesh(g,material);this.apron.name='Edge-matched textured terrain';this.apron.receiveShadow=false;this.group.add(this.apron);
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
  this.panoramas.forEach((map,i)=>material.uniforms['uHorizon'+i]={value:map});
  const functions=`
   uniform sampler2D uHorizon0,uHorizon1,uHorizon2;
   uniform vec3 uHorizonEye;uniform float uHorizonSeason;
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
  material.needsUpdate=true;
  if(this.land.sky)this.land.sky.onBeforeRender=(_renderer,_scene,camera)=>this.update(camera);
 }
 update(camera){this.eye.value.copy(camera.position);}
 dispose(){this.group.removeFromParent();for(const m of[this.apron,...this.riverMeshes]){m.geometry.dispose();m.material.dispose();}this.biomeTexture.dispose();this.panoramas.forEach(t=>t.dispose());}
}
