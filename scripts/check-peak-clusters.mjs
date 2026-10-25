import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('../dist/terrain-editor/',import.meta.url);
const mu='data:text/javascript;base64,'+fs.readFileSync(new URL('model.js',dir)).toString('base64');
const wu='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('watersheds.js',dir),'utf8').replace('./model.js?v=4',mu)).toString('base64');
const m=await import(mu),w=await import(wu),c=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('peak-clusters.js',dir),'utf8').replace('./model.js?v=4',mu).replace('./watersheds.js?v=3',wu)).toString('base64'));
const before=m.makeDocument(),oldHeights={'main-peak':6840,'west-peak':6380,'sw-peak':6060,'south-peak':5740,'north-peak':6360,'east-peak':5680};
for(let f of before.features)if(oldHeights[f.id])f.elevation=oldHeights[f.id];
before.features=before.features.filter(f=>!['meadow-west','snow-sw','river-east'].includes(f.id));
before.features.find(f=>f.id==='village-nw').points=[[6.13,1.36]];before.features.find(f=>f.id==='village-nw').elevation=2500;
before.features.push({id:'custom-north-forest',name:'我的北部森林',type:'forest',closed:true,points:[[6.8,0],[6.9,2.1],[9.5,1.5],[10.7,2.1],[11.8,0]]});
before.features.push({id:'custom-moon-lake',name:'月汀湖',type:'lake',elevation:3500,closed:true,points:[[5.05,13.05],[5.65,12.31],[6.14,12.38],[6.36,12.69],[6.1,13.35],[5.95,13.72],[5.12,13.46]]});
w.redesignWatersheds(before);
const doc=m.clone(before),source=m.fieldFor(before.features,401,321,400,before.terrainBase);
assert.equal(c.redesignPeakClusters(doc),true);
m.validateDocument(JSON.parse(JSON.stringify(doc)));
for(let f of before.features.filter(f=>!['contour','river'].includes(f.type)&&f.constraint!=='saddle'&&!c.CLUSTER_PARENTS[f.id]))assert.deepEqual(doc.features.find(n=>n.id===f.id),f,`Preserve ${f.name}`);
for(let id of ['meadow-west','snow-sw','river-east'])assert(!doc.features.some(f=>f.id===id));
const field=m.fieldFor(doc.features,401,321,500,doc.terrainBase),audit=w.drainageAudit(field);
assert(audit.maxDepth<.2,`No closed depressions, got ${audit.maxDepth} m`);
let newPeaks=doc.features.filter(f=>f.type==='peak'&&f.clusterParent);assert.equal(newPeaks.length,8);
for(let[id,spec]of Object.entries(c.CLUSTER_PARENTS)){
 let p=doc.features.find(f=>f.id===id),old=before.features.find(f=>f.id===id),group=newPeaks.filter(f=>f.clusterParent===id);
 assert.equal(p.elevation,spec.height);assert.deepEqual(p.points,old.points);assert(group.length>=2&&group.length<=3);
 let va=0,vb=0;for(let j=0;j<321;j++)for(let i=0;i<401;i++)if(Math.hypot(i*.05-p.points[0][0],j*.05-p.points[0][1])<1.7){let k=j*401+i;va+=Math.max(0,source.values[k]-3000);vb+=Math.max(0,field.values[k]-3000);}
 assert(vb/va<.8,`${p.name}: core volume must shrink`);
 console.log(`${p.name}: ${old.elevation} -> ${p.elevation} m, core relief volume ${(vb/va*100).toFixed(0)}% of previous, ${group.length} satellites`);
}
for(let p of doc.features.filter(f=>f.type==='peak'||f.constraint==='saddle'))assert(Math.abs(m.elevationAt(field,...p.points[0])-p.elevation)<.2,`Exact height for ${p.name}`);
for(let p of newPeaks){assert(p.elevation>=3900&&p.elevation<=4500);let[x,y]=p.points[0],ring=Array.from({length:24},(_,i)=>m.elevationAt(field,x+Math.cos(i*Math.PI/12)*.4,y+Math.sin(i*Math.PI/12)*.4));assert(m.elevationAt(field,x,y)>Math.max(...ring)+70,`${p.name}: distinct summit, not buried in a larger mountain`);}
let links=doc.terrainDesign.ridgeConnections,parents=new Map(),root=x=>{if(!parents.has(x))parents.set(x,x);if(parents.get(x)!==x)parents.set(x,root(parents.get(x)));return parents.get(x);};
assert.equal(links.length,13);for(let l of links){let a=root(l.from),b=root(l.to);assert.notEqual(a,b,'No ridge loop');parents.set(a,b);let peaks=doc.features.filter(f=>[l.from,l.to].includes(f.id));assert(l.elevation<Math.min(...peaks.map(f=>f.elevation)),'Pass lower than both summits');}assert.equal(new Set([...parents.keys()].map(root)).size,1);
for(let r of doc.features.filter(f=>f.type==='river')){let hs=m.samplePath(r,.025).map(p=>m.elevationAt(field,...p)),rise=0,run=0;for(let i=1;i<hs.length;i++){run=Math.max(0,run+hs[i]-hs[i-1]);rise=Math.max(rise,run);}assert(rise<1,`${r.name}: no uphill reaches (${rise} m)`);assert(r.points.some(([x,y])=>x===0||x===20||y===0||y===16));}
assert.equal(c.redesignPeakClusters(doc),false);
let edit=m.clone(doc),p=edit.features.find(f=>f.clusterParent&&f.type==='peak');p.elevation+=80;let changed=m.fieldFor(edit.features,201,161,300,edit.terrainBase);assert(Math.abs(m.elevationAt(changed,...p.points[0])-p.elevation)<.2);
console.log('14 distinct connected summits, eight 3900–4500 m satellites, acyclic ridges, lake/region preservation, drainage, JSON, idempotence and peak editing: passed');
