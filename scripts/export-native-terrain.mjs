import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {Geography, ALT_BASE, sampleLine, worldPoint, segment} from '../dist/yunxiu/core.js';
import {Hydrology} from '../dist/yunxiu/hydrology.js';
import {Earthworks} from '../dist/yunxiu/earthworks.js';
import {regionRings} from '../dist/terrain-editor/region-curves.js';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_OUTPUT = path.join(ROOT, 'production/native/generated/revision-1597');
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function loadWorld() {
  const json = fs.readFileSync(path.join(ROOT, 'dist/yunxiu/world-data.json'));
  const data = JSON.parse(json);
  if (data.source.revision !== 1597 || data.source.sha256 !== 'cf6959526d1ce86c1acaed4ac1743f38ba697a26260ce82396389c90b4c5f757') throw Error('Frozen-map identity changed: review a new map before exporting.');
  const raw = fs.readFileSync(path.join(ROOT, 'dist/yunxiu', data.terrain.url));
  const heights = new Float32Array(data.terrain.columns * data.terrain.rows);
  if (raw.length !== heights.length * 4) throw Error('Unexpected terrain length');
  for (let i = 0; i < heights.length; i++) heights[i] = raw.readFloatLE(i * 4);
  if (!heights.every(Number.isFinite)) throw Error('Non-finite terrain');
  const geo = new Geography(data, heights);
  geo.clearTrails();
  const hydro = new Hydrology(geo);
  return {data, json, raw, geo, hydro};
}

export function exportNative(output = DEFAULT_OUTPUT) {
  const {data, json, raw, geo, hydro} = loadWorld();
  fs.mkdirSync(output, {recursive: true});
  const files = [];
  const write = (name, content) => {
    const bytes = typeof content === 'string' ? Buffer.from(content) : content;
    fs.writeFileSync(path.join(output, name), bytes);
    files.push({path: name, bytes: bytes.length, sha256: sha256(bytes)});
  };
  const writeJson = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
  write('source-world-data.json', json);
  write('source-terrain-1597.f32', raw);

  // Unreal's stored height is (uint16 - 32768) / 128 * ScaleZ cm.
  // ScaleZ=1600 gives 0.125m steps; a +2396m actor Z maps sea level to ALT_BASE.
  // This is an IMPORT PREVIEW, not an authorised replacement for the exact F32 mesh.
  const columns = 2521, rows = 2017, spacing = 20000 / (columns - 1);
  const heightmap = Buffer.alloc(columns * rows * 2);
  let quantisationError = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const altitude = geo.baseHeight(-10000 + i * spacing, -8000 + j * spacing) + ALT_BASE;
    const stored = Math.round(altitude * 8);
    if (stored < 0 || stored > 65535) throw Error('Height exceeds the chosen encoding range');
    heightmap.writeUInt16LE(stored, (j * columns + i) * 2);
    quantisationError = Math.max(quantisationError, Math.abs(stored / 8 - altitude));
  }
  write('landscape-preview-2521x2017.r16', heightmap);

  // A second import option retains every ORIGINAL 50m sample location.
  // Padding is outside the playable 20x16km bounds, never new approved geography.
  const paddedColumns=505,paddedRows=379,padX=52,padY=29;
  const padded=Buffer.alloc(paddedColumns*paddedRows*2);
  let paddedEncodingError=0;
  for(let j=0;j<paddedRows;j++)for(let i=0;i<paddedColumns;i++){
    const x=Math.max(0,Math.min(400,i-padX)),y=Math.max(0,Math.min(320,j-padY));
    const altitude=geo.heights[y*401+x],stored=Math.round(altitude*8);
    padded.writeUInt16LE(stored,(j*paddedColumns+i)*2);
    paddedEncodingError=Math.max(paddedEncodingError,Math.abs(stored/8-altitude));
  }
  write('landscape-source-grid-505x379.r16',padded);

  // Measure the additional mesh reconstruction error, distinct from encoding error.
  // A resampled grid can round a summit even with perfect 16-bit values.
  const previewAt = (east, south) => {
    const fx = (east + 10000) / spacing, fy = (south + 8000) / spacing;
    const i = Math.min(columns - 2, Math.max(0, Math.floor(fx)));
    const j = Math.min(rows - 2, Math.max(0, Math.floor(fy)));
    const u = fx - i, v = fy - j;
    const h = (dx, dy) => heightmap.readUInt16LE(((j + dy) * columns + i + dx) * 2) / 8;
    return u + v <= 1 ? h(0, 0) * (1-u-v) + h(1, 0) * u + h(0, 1) * v : h(1, 1) * (u+v-1) + h(0, 1) * (1-u) + h(1, 0) * (1-v);
  };
  let reconstructionError = {metres: 0};
  for (let j = 0; j < 321; j++) for (let i = 0; i < 401; i++) {
    const east = -10000 + i * 50, south = -8000 + j * 50;
    const original = geo.heights[j * 401 + i], preview = previewAt(east, south);
    if (Math.abs(original-preview) > reconstructionError.metres) reconstructionError = {metres: Math.abs(original-preview), east, south, originalAltitude: original, previewAltitude: preview};
  }

  const point3 = (p, elevation) => {
    const [east, south] = worldPoint(p);
    return [east, south, elevation ?? geo.height(east, south) + ALT_BASE];
  };
  const active = data.features.filter(f => !['trail', 'bridge'].includes(f.type));
  writeJson('features-local-metres.json', {
    schema: 'yunxiu-local-features/1',
    coordinates: '[east metres, south metres, absolute elevation metres]; local Cartesian, NOT WGS84/GeoJSON',
    features: active.map(f => ({
      id: f.id, name: f.name, type: f.type, source: f,
      geometry: f.closed ? {type: 'Polygon', rings: regionRings(f, .012).map(r => r.map(p => point3(p, f.type === 'lake' ? f.elevation : undefined)))} : f.points.length === 1 ? {type: 'Point', point: point3(f.points[0])} : {type: 'LineString', points: sampleLine(f, .012).map(p => point3(p))}
    }))
  });
  writeJson('hydrology.json', {
    schema: 'yunxiu-hydrology-transfer/1', altitudeBase: ALT_BASE, lakeMaxDepthMetres: 8.75,
    note: 'Runtime life-2 water/bed reference, not a claim of native-engine acceptance. Base R16 does not include these beds. Sample meshes use this model. All native water and collision must use the same surfaces.',
    lakes: hydro.lakeRecords.map(l => ({id: l.feature.id, name: l.feature.name, surfaceAbsolute: l.level+ALT_BASE, shoreMetres: l.shore, maxInsetMetres: l.maxInset, deepestEastSouth: l.deepest, rings: l.rings})),
    rivers: hydro.riverRecords.map(r => ({id: r.feature.id, name: r.feature.name, widthMetres: r.width, points: r.points.map((p, i) => [...p, r.levels[i]+ALT_BASE])})),
    falls: hydro.falls.map(f => ({id: f.feature.id, name: f.feature.name, startEastSouth: f.a, endEastSouth: f.b, widthMetres: f.width, topAbsolute: f.top+ALT_BASE, bottomAbsolute: f.bottom+ALT_BASE, dropMetres: f.feature.drop}))
  });
  // Full original ecology data is already in the exact JSON copy; no reclassified bands.
  writeJson('ecology.json', data.ecology);

  const lodge = geo.settlements.find(s => s.id === 'estate-qinglan');
  const lake = hydro.lakeRecords.find(l => l.feature.id === 'lake-east');
  let nearest = {distance: Infinity};
  for (let i = 0; i < lake.rings[0].length; i++) {
    const a = lake.rings[0][i], b = lake.rings[0][(i+1)%lake.rings[0].length];
    const q = segment(lodge.point, a, b);
    if (q.distance < nearest.distance) nearest = {...q, point: a.map((v, k) => v+(b[k]-v)*q.t)};
  }
  const grids = [];
  for (const spec of [{id:'context', centre:[1150,-3200], size:1000, spacing:5}, {id:'detail', centre:nearest.point, size:200, spacing:1}]) {
    const n = Math.round(spec.size / spec.spacing) + 1;
    const origin = spec.centre.map(v => v-spec.size/2);
    const bytes = Buffer.alloc(n*n*4);
    let floatError = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const h = geo.height(origin[0]+i*spec.spacing, origin[1]+j*spec.spacing)+ALT_BASE;
      bytes.writeFloatLE(h, (j*n+i)*4);
      floatError = Math.max(floatError, Math.abs(bytes.readFloatLE((j*n+i)*4)-h));
    }
    const file = `study-${spec.id}.f32`;
    write(file, bytes);
    grids.push({...spec, columns:n, rows:n, originEastSouth:origin, file, encoding:'float32-little-endian-absolute-metres', maxFloat32EncodingErrorMetres:floatError, content:'life-2 ground including hydrology; no new artistic displacement, no player roads'});
  }
  writeJson('study.json', {name:'晴岚山庄—风镜湖西岸', lodgeId:lodge.id, lakeId:lake.feature.id, siteIsProposed:true, lakeSurfaceAbsolute:lake.level+ALT_BASE, lodgeGroundAbsolute:geo.height(...lodge.point)+ALT_BASE, grids, note:'Context and detail are alternative inspection surfaces; do not render overlapping copies. Resampling adds vertices, not genuine new geological detail.'});

  // A numeric transfer fixture for the riskiest gameplay requirement.
  // Native road code must match geometry/collision against these reference values.
  const earth = new Earthworks(geo);
  let site;
  for (let z=-6500; z<6500 && !site; z+=271) for (let x=-8500; x<8500; x+=313) {
    const grade=geo.slope(x,z).grade;
    if (!geo.waterAt(x,z) && grade>.12 && grade<.5) {site={x,z}; break;}
  }
  if (!site) throw Error('No cross-slope road fixture found');
  earth.begin(site.x,site.z,{material:'stone',bridgeMaterial:'wood',width:4});
  earth.add(site.x+12,site.z); earth.stop();
  const s=earth.segments[1], cx=(s.a[0]+s.b[0])/2, cz=(s.a[1]+s.b[1])/2;
  const samples=[];
  for(let offset=-12;offset<=12;offset+=.5) samples.push({offsetMetres:offset,pointEastSouth:[cx,cz+offset],beforeAbsolute:hydro.ground(cx,cz+offset)+ALT_BASE,afterAbsolute:geo.height(cx,cz+offset)+ALT_BASE});
  writeJson('road-cross-section-fixture.json',{schema:'yunxiu-road-reference/1', widthMetres:4, roads:earth.serialize(), samples, note:'Reference numbers only; no native implementation exists yet. A flat-width road requires cut/fill geometry, single collision authority, persistence and map updates, not only a decal.'});

  const manifest={
    schema:'yunxiu-native-bridge/1', source:data.source,
    sourceWorldJsonSha256:sha256(json), sourceTerrainSha256:sha256(raw),
    dimensionsMetres:[20000,16000], altitudeBase:ALT_BASE,
    axes:{source:'X east, Z south, Y elevation above 1700m',unreal:'X=east*100, Y=south*100, Z=(absolute-1700)*100 cm',blender:'X=east, Y=-south, Z=absolute-1700 metres',north:'-Unreal Y, +Blender Y'},
    authoritativeTerrain:{file:'source-terrain-1597.f32',columns:401,rows:321,spacingMetres:50,originEastSouth:[-10000,-8000],status:'byte-identical base terrain; add the exported shared hydrology model to obtain life-2 ground'},
    landscapeSourceGrid:{file:'landscape-source-grid-505x379.r16',columns:505,rows:379,sectionQuads:63,sectionsPerComponent:2,components:[4,3],scaleCentimetres:[5000,5000,1600],actorLocationCentimetres:[-1260000,-945000,239600],sourceOffsetPixels:[52,29],playableBoundsEastSouthMetres:[-10000,-8000,10000,8000],quantisationErrorMetres:paddedEncodingError,status:'original sample positions retained with exterior edge padding; crop padding from play and verify engine triangle diagonals before acceptance; not high-detail terrain'},
    landscapePreview:{file:'landscape-preview-2521x2017.r16',columns,rows,sectionQuads:63,sectionsPerComponent:2,components:[20,16],scaleCentimetres:[spacing*100,spacing*100,1600],actorLocationCentimetres:[-1000000,-800000,239600],uint16ToAbsoluteMetres:'stored / 8',quantisationErrorMetres:quantisationError,reconstructionErrorAtSourceVertices:reconstructionError,status:'import/scale preview only; resampling may change the mesh, do not replace approved terrain with it'},
    sourceFeatureCount:data.features.length,activeFeatureCount:active.length,excludedPresetPaths:data.features.filter(f=>['trail','bridge'].includes(f.type)).map(f=>f.id),
    originalFeaturesAndCurvesPreserved:true,fullOriginalEcologyPreserved:true,
    execution:{dataExport:'executed',blenderImporter:'not executed',unrealImport:'not executed',nativeGameplay:'not implemented',nativeRender:'not produced'},files
  };
  fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {values}=parseArgs({options:{out:{type:'string'}}});
  const output=values.out?path.resolve(values.out):DEFAULT_OUTPUT;
  const m=exportNative(output);
  console.log(JSON.stringify({output,sourceRevision:m.source.revision,files:m.files.length,activeFeatures:m.activeFeatureCount,quantisationErrorMetres:m.landscapePreview.quantisationErrorMetres,resamplingErrorAtOriginalVertices:m.landscapePreview.reconstructionErrorAtSourceVertices,nativeRender:m.execution.nativeRender},null,2));
}
