// Editable technical geometry, without depending on an editor/GPU context.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {DEFAULT_OUTPUT,sha256} from './export-native-terrain.mjs';
const{values}=parseArgs({options:{out:{type:'string'}}});
const directory=values.out?path.resolve(values.out):DEFAULT_OUTPUT;
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json')));
const study=JSON.parse(fs.readFileSync(path.join(directory,'study.json')));
const specs=[{id:'world-base',file:manifest.authoritativeTerrain.file,columns:401,rows:321,spacing:50,originEastSouth:[-10000,-8000],surface:'exact original base; hydrology not applied'},...study.grids];
const reports=[];
for(const s of specs){
 const bytes=fs.readFileSync(path.join(directory,s.file)),count=s.columns*s.rows;
 if(bytes.length!==count*4)throw Error('Wrong grid length');
 const positions=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2),indices=new Uint32Array((s.columns-1)*(s.rows-1)*6);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let j=0;j<s.rows;j++)for(let i=0;i<s.columns;i++){
  const k=j*s.columns+i,p=[s.originEastSouth[0]+i*s.spacing,bytes.readFloatLE(k*4)-1700,s.originEastSouth[1]+j*s.spacing];
  positions.set(p,k*3);uv.set([i/(s.columns-1),j/(s.rows-1)],k*2);
  for(let a=0;a<3;a++){min[a]=Math.min(min[a],positions[k*3+a]);max[a]=Math.max(max[a],positions[k*3+a]);}
 }
 let n=0;
 for(let j=0;j<s.rows-1;j++)for(let i=0;i<s.columns-1;i++){
  const a=j*s.columns+i,b=a+1,c=a+s.columns,d=c+1;indices.set([a,c,b,b,c,d],n);n+=6;
 }
 for(let i=0;i<indices.length;i+=3){
  const[a,b,c]=[indices[i]*3,indices[i+1]*3,indices[i+2]*3],u=[0,1,2].map(k=>positions[b+k]-positions[a+k]),v=[0,1,2].map(k=>positions[c+k]-positions[a+k]);
  const nn=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(nn[1]<=0)throw Error('Downward-facing terrain triangle');
  for(const p of[a,b,c])for(let k=0;k<3;k++)normal[p+k]+=nn[k];
 }
 for(let i=0;i<count;i++){const p=i*3,l=Math.hypot(normal[p],normal[p+1],normal[p+2]);for(let a=0;a<3;a++)normal[p+a]/=l;}
 const chunks=[positions,normal,uv,indices].map(a=>Buffer.from(a.buffer));
 let offset=0;const views=chunks.map((b,i)=>{const v={buffer:0,byteOffset:offset,byteLength:b.length,target:i===3?34963:34962};offset+=b.length;return v;});
 const doc={asset:{version:'2.0',generator:'Yunxiu native geography bridge'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'Yunxiu_'+s.id,mesh:0}],
  meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
  materials:[{name:'Technical geography only',pbrMetallicRoughness:{baseColorFactor:[.36,.43,.35,1],metallicFactor:0,roughnessFactor:.95}}],buffers:[{byteLength:offset}],bufferViews:views,
  accessors:[{bufferView:0,componentType:5126,count,type:'VEC3',min,max},{bufferView:1,componentType:5126,count,type:'VEC3'},{bufferView:2,componentType:5126,count,type:'VEC2'},{bufferView:3,componentType:5125,count:indices.length,type:'SCALAR'}],
  extras:{sourceRevision:1597,sourceMapSha256:manifest.source.sha256,units:'metres',axes:'X east, Y altitude above 1700m, Z south; north=-Z',sourceSurface:s.surface||s.content,status:'editable technical reference, no final art/water surface/physics/gameplay'}};
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const binary=Buffer.concat(chunks),header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);jsonHeader.writeUInt32LE(json.length);jsonHeader.write('JSON',4);binHeader.writeUInt32LE(binary.length);binHeader.write('BIN\0',4);
 const result=Buffer.concat([header,jsonHeader,json,binHeader,binary]),file='yunxiu-geography-'+s.id+'-v01.glb';fs.writeFileSync(path.join(directory,file),result);
 // Check the produced bytes, rather than trusting just the source arrays.
 const start=28+json.length;let maxHeightError=0;
 for(let k=0;k<count;k++)maxHeightError=Math.max(maxHeightError,Math.abs(result.readFloatLE(start+k*12+4)+1700-bytes.readFloatLE(k*4)));
 if(maxHeightError>.001)throw Error('Height changed during GLB serialization');
 reports.push({file,bytes:result.length,sha256:sha256(result),vertices:count,triangles:indices.length/3,maxHeightEncodingErrorMetres:maxHeightError,surface:doc.extras.sourceSurface});
}
fs.writeFileSync(path.join(directory,'glb-validation.json'),JSON.stringify({schema:'yunxiu-geography-glb-check/1',sourceRevision:1597,diagonal:'original B-C; upward winding verified',engineExecution:'not performed; portable editable meshes only',models:reports},null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
