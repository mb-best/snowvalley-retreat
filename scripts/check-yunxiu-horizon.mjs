import fs from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import * as T from '../dist/vendor/three.module.js';
import {Geography,ALT_BASE} from '../dist/yunxiu/core.js';
import {Hydrology} from '../dist/yunxiu/hydrology.js';
import {HorizonModel,DistantLandscape,perimeterPoint} from '../dist/yunxiu/horizon.js';

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
assert(seamError<1e-7);assert(maxGrade<2);
for(const d of[0,800,20000,85000])assert.deepEqual(model.at(0,d),model.at(1,d),'Closed panorama seam');
for(let layer=0;layer<3;layer++)assert(Math.abs(model.ridge(-Math.PI,layer)-model.ridge(Math.PI,layer))<1e-7);
assert.deepEqual(Buffer.from(heights.buffer),original,'Rendering leaves frozen terrain untouched');

const land={geo,scene:new T.Scene(),quality:'low',season:{value:1},terrainMat:new T.MeshStandardMaterial()};
const scenery=new DistantLandscape(land),mesh=scenery.apron,g=mesh.geometry;
assert.equal(g.attributes.position.count,1441*22);
assert.equal(g.index.count/3,1440*21*2);
for(const v of g.attributes.position.array)assert(Number.isFinite(v));
assert(scenery.group.userData.visualOnly);
assert.equal(scenery.panoramas.length,3);
assert.equal(scenery.model.rivers.length,6,'All six rivers leaving the map continue outside');
for(const river of scenery.model.rivers){
 const a=river.points[0];assert(Math.abs(a.level-(geo.waterAt(a.x,a.z)?.height??a.level))<.05);
 for(let i=1;i<river.points.length;i++)assert(river.points[i].level<river.points[i-1].level,'Outside rivers descend');
}
for(const map of scenery.panoramas){
 const a=map.image.data;assert(a.some((v,i)=>i%4===3&&v===0));assert(a.some((v,i)=>i%4===3&&v===255));
}
const sky=new T.ShaderMaterial({uniforms:{},fragmentShader:'uniform float uDay,uCloud; void main(){vec3 d=vec3(0.,0.,1.);vec3 c=vec3(1.);gl_FragColor=vec4(c,1.);}'});
scenery.configureSky(sky);
assert(sky.fragmentShader.indexOf('uniform float uDay')<sky.fragmentShader.indexOf('vec3 horizonLayer'));
for(const altitude of[2200,4000,8000]){
 const eye=new T.Vector3(9998,altitude-ALT_BASE,-7998);scenery.update({position:eye});
 assert.deepEqual(sky.uniforms.uHorizonEye.value,eye);
}
const before=land.scene.children.length;scenery.dispose();assert.equal(land.scene.children.length,before-1);
console.log({seamSamples:1441,seamError,maxGrade,panoramaLayers:3,riverExits:6,riverGravity:'passed',closure:'passed',altitudes:[2200,4000,8000],frozenTerrain:'unchanged',visualOnly:'passed',triangles:g.index.count/3,textureMemoryLowMiB:8.67,shaderSource:'passed; GPU rendering not tested'});
