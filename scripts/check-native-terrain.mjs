import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {DEFAULT_OUTPUT, loadWorld, sha256} from './export-native-terrain.mjs';
const {values}=parseArgs({options:{out:{type:'string'}}});
const output=values.out?path.resolve(values.out):DEFAULT_OUTPUT;
const read=name=>fs.readFileSync(path.join(output,name));
const json=name=>JSON.parse(read(name));
const m=json('manifest.json'),{data,raw,geo,hydro}=loadWorld();
for(const f of m.files){const b=read(f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(sha256(b),f.sha256,f.path);}
assert(read('source-terrain-1597.f32').equals(raw),'original terrain must be byte identical');
assert.deepEqual(json('source-world-data.json'),data,'all original features and ecology retained');
assert.deepEqual(json('ecology.json'),data.ecology);
const active=json('features-local-metres.json').features;
assert.deepEqual(active.map(f=>f.id),data.features.filter(f=>!['trail','bridge'].includes(f.type)).map(f=>f.id));
assert(active.every(f=>JSON.stringify(f.source)===JSON.stringify(data.features.find(s=>s.id===f.id))),'source control points must survive');
assert(!active.some(f=>['trail','bridge'].includes(f.type)),'no prebuilt routes in native active export');
assert.equal(active.filter(f=>f.type==='village'&&f.source.placeKind!=='lodge').length,3);
assert.equal(m.landscapePreview.columns,20*126+1);assert.equal(m.landscapePreview.rows,16*126+1);
assert(Math.abs(m.landscapePreview.scaleCentimetres[0]*(2521-1)/100-20000)<1e-8);
assert(Math.abs(m.landscapePreview.scaleCentimetres[1]*(2017-1)/100-16000)<1e-8);
const r16=read(m.landscapePreview.file);
let maxR16Error=0;
for(let j=0;j<2017;j++)for(let i=0;i<2521;i++){
 const stored=r16.readUInt16LE((j*2521+i)*2),ueAboveBase=(stored-32768)/128*1600/100+2396;
 const source=geo.baseHeight(-10000+i*20000/2520,-8000+j*16000/2016);
 maxR16Error=Math.max(maxR16Error,Math.abs(ueAboveBase-source));
}
assert(maxR16Error<=.062501,'16-bit encoding error at export vertices');
const padded=read(m.landscapeSourceGrid.file);let maxPaddedError=0;
assert.equal(padded.length,505*379*2);assert.equal(505,4*126+1);assert.equal(379,3*126+1);
for(let j=0;j<321;j++)for(let i=0;i<401;i++)maxPaddedError=Math.max(maxPaddedError,Math.abs(padded.readUInt16LE(((j+29)*505+i+52)*2)/8-geo.heights[j*401+i]));
assert(maxPaddedError<=.0625,'original samples must be retained in the padded option');
let maxStudyError=0;
for(const grid of json('study.json').grids){const bytes=read(grid.file);assert.equal(bytes.length,grid.columns*grid.rows*4);
 for(let j=0;j<grid.rows;j++)for(let i=0;i<grid.columns;i++){
  const altitude=bytes.readFloatLE((j*grid.columns+i)*4);
  const expected=geo.height(grid.originEastSouth[0]+i*grid.spacing,grid.originEastSouth[1]+j*grid.spacing)+1700;
  maxStudyError=Math.max(maxStudyError,Math.abs(altitude-expected));
 }
}
assert(maxStudyError<.001,'study must use the same hydrology-aware ground as the current world');
const water=json('hydrology.json');
assert.equal(water.lakes.length,20);assert.equal(water.rivers.length,7);
assert.deepEqual(water.falls.map(f=>f.dropMetres).sort((a,b)=>a-b),[85,106]);
for(const river of water.rivers)for(let i=1;i<river.points.length;i++)assert(river.points[i][2]<=river.points[i-1][2]+1e-6,river.name+' downhill');
for(const lake of hydro.lakeRecords)assert(Math.abs(lake.level-geo.height(...lake.deepest)-8.75)<1e-6,'lake depth '+lake.feature.name);
const road=json('road-cross-section-fixture.json'),inside=road.samples.filter(s=>Math.abs(s.offsetMetres)<=1.5),outside=road.samples.filter(s=>Math.abs(s.offsetMetres)>=10);
assert(Math.max(...inside.map(s=>s.afterAbsolute))-Math.min(...inside.map(s=>s.afterAbsolute))<1e-6,'road transverse surface is level');
assert(outside.every(s=>Math.abs(s.afterAbsolute-s.beforeAbsolute)<1e-6),'outside road shoulders original terrain retained');
const report={schema:'yunxiu-native-bridge-validation/1',sourceRevision:m.source.revision,sourceMapSha256:m.source.sha256,originalTerrainByteIdentical:true,sourceFeatures:331,activeFeatures:active.length,excludedPresetPaths:m.excludedPresetPaths.length,ecology:'exact original copy',lakes:water.lakes.length,rivers:water.rivers.length,fallsMetres:[106,85],r16Dimensions:[2521,2017],r16MaximumEncodingErrorMetres:maxR16Error,landscapePreviewMeshErrorAtSourceVertices:m.landscapePreview.reconstructionErrorAtSourceVertices,sourceGridPaddedDimensions:[505,379],sourceGridPaddedMaxEncodingErrorMetres:maxPaddedError,studyMaximumFloat32ErrorMetres:maxStudyError,roadCrossSectionFixture:'level width, recovered outside shoulder',nativeRendering:'not executed; data validation is not engine or visual acceptance'};
fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
