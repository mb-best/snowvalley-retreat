// Run with node scripts/check-watersheds.mjs (no build or dependencies required).
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../dist/terrain-editor/',import.meta.url);
const modelURL='data:text/javascript;base64,'+fs.readFileSync(new URL('model.js',base)).toString('base64');
const m=await import(modelURL);
const w=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL('watersheds.js',base),'utf8').replace('./model.js?v=4',modelURL)).toString('base64'));
const shipped=JSON.parse(fs.readFileSync(new URL('default-terrain.json',base)));
const fixture=m.makeDocument();
for(let p of fixture.features.filter(f=>f.type==='peak'))p.elevation=shipped.features.find(f=>f.id===p.id).elevation;
fixture.features=fixture.features.filter(f=>!['meadow-west','snow-sw','river-east'].includes(f.id));
let lake=fixture.features.find(f=>f.id==='lake-north');lake.points=lake.points.map(([x,y])=>[x-.4,y+.8]);lake.elevation=3900;
fixture.features.push({id:'custom-moon-lake',type:'lake',name:'月汀湖',closed:true,elevation:3500,points:[[5.05,13.05],[5.65,12.31],[6.14,12.38],[6.36,12.69],[6.1,13.35],[5.95,13.72],[5.12,13.46]]});
fixture.features.push({id:'custom-trail',type:'trail',name:'问山径',closed:false,points:[[5.7,6.9],[6.8,7.7],[9.0,6.3],[11.8,6.55]]});
const protectedBefore=fixture.features.filter(f=>!['contour','river','ridge'].includes(f.type));
assert.equal(w.redesignWatersheds(fixture),true);
for(let f of protectedBefore)assert.deepEqual(fixture.features.find(n=>n.id===f.id),f,`Retain ${f.name}`);
for(let id of ['meadow-west','snow-sw','river-east'])assert(!fixture.features.some(f=>f.id===id),`Do not restore deleted ${id}`);
for(let [name,doc] of [['shipped',shipped],['edited',fixture]]){
 m.validateDocument(JSON.parse(JSON.stringify(doc)));
 const field=m.fieldFor(doc.features,401,321,500,doc.terrainBase),audit=w.drainageAudit(field);
 assert(audit.maxDepth<.2,`${name}: unintended closed depressions ${audit.maxDepth} m`);
 const links=doc.terrainDesign.ridgeConnections,parent=new Map();
 const root=x=>{if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,root(parent.get(x)));return parent.get(x);};
 assert.equal(links.length,5);
 for(let e of links){let a=root(e.from),b=root(e.to);assert.notEqual(a,b,'No closed ridge cycle');parent.set(a,b);}
 assert.equal(new Set([...parent.keys()].map(root)).size,1,'All six peaks connected');
 let maxRiverRise=0;
 for(let f of doc.features){
  if(f.type==='peak'||f.type==='village'||f.constraint==='saddle')assert(Math.abs(m.elevationAt(field,...f.points[0])-f.elevation)<.2,`${f.name}: exact point elevation`);
  if(f.type==='lake'){let c=f.points.reduce((s,p)=>s.map((x,i)=>x+p[i]/f.points.length),[0,0]);assert(Math.abs(m.elevationAt(field,...c)-f.elevation)<.2,`${f.name}: retained lake plane`);}
  if(f.type==='river'){
   assert(f.points.some(([x,y])=>x===0||x===20||y===0||y===16),`${f.name}: outlet reaches boundary`);
   let hs=m.samplePath(f,.025).map(p=>m.elevationAt(field,...p)),rise=0,run=0;
   for(let i=1;i<hs.length;i++){run=Math.max(0,run+hs[i]-hs[i-1]);rise=Math.max(rise,run);}maxRiverRise=Math.max(maxRiverRise,rise);
  }
 }
 assert(maxRiverRise<1,`${name}: water must not run uphill (${maxRiverRise} m)`);
 const count=doc.features.length;assert.equal(w.redesignWatersheds(doc),false);assert.equal(doc.features.length,count,'No duplicate migration objects');
 console.log(`${name}: six connected peaks, five acyclic links, ${doc.features.filter(f=>f.type==='contour').length} contours, no >0.2 m closed depressions, river rise <1 m`);
}
// A flat interior pit must be detected; a cut through its rim must drain it.
let pit={nx:5,ny:5,values:Array(25).fill(100)};pit.values[12]=30;assert.equal(w.drainageAudit(pit).maxDepth,70);pit.values[11]=30;pit.values[10]=30;assert.equal(w.drainageAudit(pit).maxDepth,0);
// A real edit must still deform the reference heightfield after the redesign.
let edited=m.clone(shipped),pass=edited.features.find(f=>f.constraint==='saddle');pass.elevation+=120;
let adjusted=m.fieldFor(edited.features,201,161,300,edited.terrainBase);assert(Math.abs(m.elevationAt(adjusted,...pass.points[0])-pass.elevation)<.2);
console.log('JSON round-trip, retained custom geometry, priority-flood detection, idempotence and editable pass height: passed');
