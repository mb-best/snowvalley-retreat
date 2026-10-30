import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as T from '../dist/vendor/three.module.js';
import {Geography,ALT_BASE} from '../dist/yunxiu/core.js';
import {Hydrology} from '../dist/yunxiu/hydrology.js';
import {HorizonModel,DistantLandscape,perimeterPoint,RINGS} from '../dist/yunxiu/horizon.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const data=JSON.parse(fs.readFileSync(root+'dist/yunxiu/world-data.json'));
const bytes=fs.readFileSync(root+'dist/yunxiu/'+data.terrain.url);
const heights=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const original=Buffer.from(bytes),geo=new Geography(data,heights);new Hydrology(geo);
const model=new HorizonModel(geo);
let seamError=0,maxGrade=0;
for(let i=0;i<=1440;i++){
 const [x,z]=perimeterPoint(i/1440),p=model.at(i/1440,0);
 seamError=Math.max(seamError,Math.abs(p.y-geo.height(x,z)));
 assert(Math.hypot(p.x-x,p.z-z)<1e-8);
 const a=model.at(i/1440,1),b=model.at(i/1440,2);
 maxGrade=Math.max(maxGrade,Math.abs(a.y-b.y)/Math.hypot(a.x-b.x,a.z-b.z));
 for(const d of[0,100,800,3500,10000,30000,85000]){
  const q=model.at(i/1440,d);assert(Object.values(q).every(Number.isFinite));
  assert(q.y>-4000&&q.y<8500,'Scenery altitude stays plausible');
 }
}
assert(seamError<1e-7);assert(maxGrade<2.2,'Continuation follows the authored edge slope');
for(const d of[0,800,20000,85000])assert.deepEqual(model.at(0,d),model.at(1,d),'Closed panorama seam');
for(let layer=0;layer<3;layer++)assert(Math.abs(model.ridge(-Math.PI,layer)-model.ridge(Math.PI,layer))<1e-7);
assert.deepEqual(Buffer.from(heights.buffer),original,'Rendering leaves frozen terrain untouched');

const land={geo,scene:new T.Scene(),quality:'low',season:{value:1},terrainMat:new T.MeshStandardMaterial()};
const scenery=new DistantLandscape(land),mesh=scenery.apron,g=mesh.geometry;
assert.equal(g.attributes.position.count,1441*RINGS.length);
assert.equal(g.index.count/3,1440*(RINGS.length-1)*2);
for(const v of g.attributes.position.array)assert(Number.isFinite(v));
assert(scenery.group.userData.visualOnly);
assert.equal(scenery.panoramas.length,3);
assert.equal(mesh.material.transparent,false,'Exterior terrain is solid depth-writing ground');
assert.equal(mesh.material.depthWrite,true);
assert(RINGS.at(-1)>150000,'End of terrain lies beyond clear-weather visibility');
let normalError=0,slopeError=0;
for(let i=0;i<1440;i++){
 const [x,z]=perimeterPoint(i/1440),n=model.normal(x,z),v=new T.Vector3().fromBufferAttribute(g.attributes.normal,i);
 normalError=Math.max(normalError,n.distanceTo(v));
 // Compare normal slopes, rather than requiring both sides to be horizontal.
 if((x===-10000||x===10000)&&Math.abs(z)<7900){
  const sx=Math.sign(x),inside=(geo.height(x,z)-geo.height(x-sx*.1,z))/.1;
  const outside=(model.height(x+sx*.1,z)-geo.height(x,z))/.1;
  slopeError=Math.max(slopeError,Math.abs(inside-outside));
 }
 if((z===-8000||z===8000)&&Math.abs(x)<9900){
  const sz=Math.sign(z),inside=(geo.height(x,z)-geo.height(x,z-sz*.1))/.1;
  const outside=(model.height(x,z+sz*.1)-geo.height(x,z))/.1;
  slopeError=Math.max(slopeError,Math.abs(inside-outside));
 }
}
assert(normalError<1e-6,'Shared boundary normals');
assert(slopeError<.25,'No artificial cliff at the boundary');
for(const x of[-10000,10000])for(const z of[-8000,8000])for(const d of[.1,10,100,500,2000]){
 const sx=Math.sign(x),sz=Math.sign(z),q=model.height(x+sx*d,z+sz*d);
 assert(Number.isFinite(q));
 assert(Math.abs(model.height(x+sx*d,z-.01)-model.height(x+sx*d,z+.01))<.5,'No height jump between side and corner');
 assert(Math.abs(model.height(x-.01,z+sz*d)-model.height(x+.01,z+sz*d))<.5,'No height jump at the other corner side');
}
assert.equal(scenery.model.rivers.length,6,'All six rivers leaving the map continue outside');
mesh.updateMatrixWorld(true);const ray=new T.Raycaster();let maxRiverBankGrade=0,minRiverClearance=Infinity;
for(const river of scenery.model.rivers){
 const a=river.points[0];assert(Math.abs(a.level-(geo.waterAt(a.x,a.z)?.height??a.level))<.05);
 for(let i=1;i<river.points.length;i++)assert(river.points[i].level<river.points[i-1].level,'Outside rivers descend');
 for(let i=10;i<100;i+=10){
  const p=river.points[i],a=river.points[i-1],b=river.points[i+1],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
  ray.set(new T.Vector3(p.x,12000,p.z),new T.Vector3(0,-1,0));
  const floor=ray.intersectObject(mesh)[0];assert(floor,'Exterior river has ground below');
  const clearance=p.level-floor.point.y;minRiverClearance=Math.min(minRiverClearance,clearance);
  assert(clearance>1&&clearance<6,'Actual rendered triangles leave a visible, shallow river channel');
  for(let offset=-2500;offset<=2500;offset+=200){
   const n=model.normal(p.x-dz/length*offset,p.z+dx/length*offset);
   maxRiverBankGrade=Math.max(maxRiverBankGrade,Math.hypot(n.x,n.z)/n.y);
  }
 }
}
assert(maxRiverBankGrade<2,'No near-vertical exterior river slots');
for(const map of scenery.panoramas){
 const a=map.image.data;assert(a.some((v,i)=>i%4===3&&v===0));assert(a.some((v,i)=>i%4===3&&v===255));
}
const sky=new T.ShaderMaterial({uniforms:{},fragmentShader:'uniform float uDay,uCloud; void main(){vec3 d=vec3(0.,0.,1.);vec3 c=vec3(1.);gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}'});
scenery.configureSky(sky);
assert(sky.fragmentShader.indexOf('uniform float uDay')<sky.fragmentShader.indexOf('vec3 horizonLayer'));
assert(sky.fragmentShader.includes('uHorizonFog'),'Sky and distant terrain share horizon fog color');
const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
mesh.material.onBeforeCompile(shader);
assert(!shader.fragmentShader.includes('opticalDepth'),'No reduced-fog exterior sheet');
assert(!shader.fragmentShader.includes('uDistantBiome'),'No stretched ring UV noise texture');
for(const altitude of[2200,4000,8000]){
 const eye=new T.Vector3(9998,altitude-ALT_BASE,-7998);scenery.update({position:eye});
 assert.deepEqual(sky.uniforms.uHorizonEye.value,eye);
}
const before=land.scene.children.length;scenery.dispose();assert.equal(land.scene.children.length,before-1);
console.log({seamSamples:1441,seamError,maxGrade,normalError,slopeError,maxRiverBankGrade,minRiverClearance,panoramaLayers:3,riverExits:6,riverGravity:'passed',closure:'passed',altitudes:[2200,4000,8000],frozenTerrain:'unchanged',visualOnly:'passed',triangles:g.index.count/3,shaderSource:'passed; see browser review separately'});
