import assert from'node:assert/strict';
import * as T from'../dist/vendor/three.module.js';
import{mp4Type,isMP4,GameRecorder}from'../dist/yunxiu/recording.js';
import{WILDLIFE_SPECIES,speciesAllowed,makeWildlife,Wildlife}from'../dist/yunxiu/wildlife.js';

const context=new Proxy({},{get:(o,k)=>o[k]||(()=>{})});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
assert.equal(WILDLIFE_SPECIES.length,8);assert.equal(new Set(WILDLIFE_SPECIES.map(s=>s.id)).size,8);
for(const s of WILDLIFE_SPECIES){const model=makeWildlife(s);assert(model.root.children.length);model.root.traverse(o=>{if(o.isMesh){for(const v of o.geometry.attributes.position.array)assert(Number.isFinite(v));}});assert(!speciesAllowed(s,{altitude:8000,tree:1,grass:1,grade:.1}));}
assert(speciesAllowed(WILDLIFE_SPECIES.find(s=>s.id==='goat'),{altitude:4400,tree:0,grass:0,grade:.4}));
assert(!speciesAllowed(WILDLIFE_SPECIES.find(s=>s.id==='deer'),{altitude:4400,tree:0,grass:0,grade:.4}));
const geo={height:()=>0,waterAt:()=>null,settlements:[],ecological:()=>({altitude:2800,tree:.4,grass:.5,grade:.1})},land={collides:()=>false},scene=new T.Scene(),wild=new Wildlife(scene,geo,land,77),player=new T.Vector3(100,0,100);
wild.refresh(player);const first=wild.animals.map(a=>[a.species.id,a.homeX,a.homeZ]);assert(first.length>5&&first.length<=22);wild.update(.02,5,player,{flying:false});assert(wild.animals.every(a=>Number.isFinite(a.root.position.y)));wild.cell='';wild.refresh(player);assert.deepEqual(wild.animals.map(a=>[a.species.id,a.homeX,a.homeZ]),first,'Same saved seed retains animal placements');wild.update(.02,6,new T.Vector3(100,1000,100),{flying:true});assert(wild.animals.every(a=>!a.root.visible));

// Unit fixture for browser API orchestration; this is a synthetic container
// header, not an encoded video or a claim that browser codecs were exercised.
const header=new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109,97,118,99,49]);
assert(await isMP4(new Blob([header])));assert(!await isMP4(new Blob(['webm-not-mp4'])));
const previousRecorder=globalThis.MediaRecorder,previousPicker=globalThis.showSaveFilePicker;let captured=0,stopped=0,picked=0,written=null,closed=false,phase='idle';
class Recorder{static isTypeSupported(type){return type.startsWith('video/mp4');}constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob([header],{type:this.mimeType})});this.onstop();}}
globalThis.MediaRecorder=Recorder;globalThis.showSaveFilePicker=async()=>{picked++;return{createWritable:async()=>({write:async b=>{written=b;},close:async()=>{closed=true;},abort:async()=>{}})}};
const canvas={captureStream:fps=>{assert.equal(fps,30);captured++;return{getTracks:()=>[{kind:'video',stop:()=>stopped++}]}}},record=new GameRecorder(canvas,{onState:s=>phase=s});assert(mp4Type());await record.start(true);assert(record.active&&captured===1&&picked===1);record.stop();for(let i=0;i<20&&phase!=='ready';i++)await new Promise(r=>setTimeout(r,1));assert.equal(phase,'ready');assert(closed&&written&&await isMP4(written)&&stopped===1);assert.equal(written.type.toLowerCase(),'video/mp4;codecs=avc1');Recorder.isTypeSupported=()=>false;assert.equal(mp4Type(),null);const unsupported=new GameRecorder(canvas);await assert.rejects(unsupported.start(),/MP4/);assert.equal(captured,1,'No capture on unsupported codec');globalThis.MediaRecorder=previousRecorder;globalThis.showSaveFilePicker=previousPicker;
console.log({eightDistinctWildlifeMeshes:'passed',habitatAndAltitudeRules:'passed',boundedSpawnAndSavedSeed:'passed',canvasOnlyRecordingOrchestration:'passed with mocked APIs',mp4ContainerCheckAndSaveLocation:'passed with synthetic header',unsupportedCodecRejected:'passed',browserEncodingAndVisualQA:'not tested'});
