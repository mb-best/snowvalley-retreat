import fs from 'node:fs';import assert from 'node:assert/strict';
const dir=new URL('../dist/terrain-editor/',import.meta.url),data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),mu=data(fs.readFileSync(new URL('model.js',dir))),wu=data(fs.readFileSync(new URL('watersheds.js',dir),'utf8').replace('./model.js?v=4',mu));
const m=await import(mu),w=await import(wu),g=await import(data(fs.readFileSync(new URL('gentle-satellites.js',dir),'utf8').replace('./model.js?v=4',mu).replace('./watersheds.js?v=3',wu)));
const original=JSON.parse(fs.readFileSync(new URL('cluster-03-baseline.json',dir))),doc=m.clone(original),old=m.fieldFor(original.features,401,321,400,original.terrainBase);
assert.equal(g.gentlyMoveSatellites(doc),true);m.validateDocument(JSON.parse(JSON.stringify(doc)));
for(let f of original.features.filter(f=>f.type!=='contour'&&!f.clusterParent))assert.deepEqual(doc.features.find(n=>n.id===f.id),f,`Keep original ${f.name}`);
const moving=doc.features.filter(f=>f.type==='peak'&&f.clusterParent);assert.equal(moving.length,8);
for(let f of moving){let before=original.features.find(n=>n.id===f.id),parent=original.features.find(n=>n.id===f.clusterParent).points[0],a=before.points[0],b=f.points[0],r=Math.hypot(a[0]-parent[0],a[1]-parent[1]),move=Math.hypot(a[0]-b[0],a[1]-b[1]);assert(Math.abs(move-Math.min(r*.1,.35))<1e-8);assert.equal(f.elevation,before.elevation);}
const field=m.fieldFor(doc.features,401,321,500,doc.terrainBase),audit=w.drainageAudit(field);assert(audit.maxDepth<.2);
let maxCoreDifference=0,outerDifference=0,outerBaseDifference=0,areaA=0,areaB=0;
const majors=original.features.filter(f=>f.type==='peak'&&!f.clusterParent),low=original.features.filter(f=>f.type==='peak'&&f.clusterParent);
for(let j=0;j<321;j++)for(let i=0;i<401;i++){let x=i*.05,y=j*.05,k=j*401+i,d=Math.abs(field.values[k]-old.values[k]);if(majors.some(f=>Math.hypot(x-f.points[0][0],y-f.points[0][1])<=.45))maxCoreDifference=Math.max(maxCoreDifference,d);if(low.every(f=>Math.hypot(x-f.points[0][0],y-f.points[0][1])>3)){outerDifference=Math.max(outerDifference,d);outerBaseDifference=Math.max(outerBaseDifference,Math.abs(doc.terrainBase.values[k]-old.values[k]));}areaA+=old.values[k]>=3500;areaB+=field.values[k]>=3500;}
console.log({maxCoreDifference,outerDifference,outerBaseDifference});assert(maxCoreDifference<.2,`Major mountain bodies: ${maxCoreDifference} m`);assert(outerDifference<.2,`Original terrain outside local edits: ${outerDifference} m`);assert(Math.abs(areaB/areaA-1)<.05,'No overall terrain compression');
for(let f of doc.features){if(f.type==='peak'||f.constraint==='saddle')assert(Math.abs(m.elevationAt(field,...f.points[0])-f.elevation)<.2);if(f.type==='river'){let hs=m.samplePath(f,.025).map(p=>m.elevationAt(field,...p)),up=0,run=0;for(let i=1;i<hs.length;i++){run=Math.max(0,run+hs[i]-hs[i-1]);up=Math.max(up,run);}assert(up<1,`${f.name}: no uphill reaches`);}}
assert.equal(g.gentlyMoveSatellites(doc),false);
const rejected=m.clone(original);rejected.compactMassifVersion=1;assert.throws(()=>g.gentlyMoveSatellites(rejected),/恢复峰群草案03/);
console.log(`Only eight satellites moved inward, max 350 m; all major features unchanged, summit core delta ${maxCoreDifference.toFixed(3)} m, outer terrain delta ${outerDifference.toFixed(3)} m, 3500 m footprint ratio ${(areaB/areaA).toFixed(3)}; drainage, JSON and idempotence: passed`);
