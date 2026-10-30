import assert from'node:assert/strict';
import * as T from'../dist/vendor/three.module.js';
import{BASE_SPEED,DEFAULT_SPEEDS,SPEED_LIMITS,speedsFrom,baseSpeedFrom,movementSpeed}from'../dist/yunxiu/life-rules.js';
import{flightStep,WindRider}from'../dist/yunxiu/flight.js';
import{groundRoute,AutoTravel,mapPointer,coordinateText}from'../dist/yunxiu/navigation.js';

assert.equal(BASE_SPEED*60/1000,10,'10 kilometres/minute');
const limits=speedsFrom(Object.fromEntries(Object.keys(SPEED_LIMITS).map(k=>[k,999])));
assert.deepEqual(limits,SPEED_LIMITS);
assert.equal(movementSpeed(limits,{flying:true,boost:true}),BASE_SPEED*100);
assert.equal(movementSpeed(limits,{flying:true}),BASE_SPEED*20);
assert.equal(movementSpeed(limits,{riding:true,boost:true}),BASE_SPEED*20);
assert.equal(limits.vertical,40);
assert.equal(movementSpeed(DEFAULT_SPEEDS,{baseSpeed:baseSpeedFrom(10/3.6)}),10/3.6);
assert.equal(speedsFrom({flightBoost:20}).flightBoost,20,'Preserve previous saved choice');
assert.equal(baseSpeedFrom(undefined),BASE_SPEED);

const flat={height:()=>0,waterAt:()=>null},ridge={height:(x)=>x>=48&&x<=52?300:0};
const stopped=flightStep({x:0,y:80,z:0},200,0,0,1/60,ridge);
assert(stopped.x<48&&stopped.y===80,'A fast frame cannot tunnel through a ridge');
const high=flightStep({x:0,y:2000,z:0},30000,30000,10000,1,flat);
assert(high.x<=9999&&high.z<=7999&&high.y<=6300,'World/8000m limits at extreme speed');
const combined=flightStep({x:0,y:500,z:0},BASE_SPEED*100*.01,0,BASE_SPEED*40,.01,flat);assert(Math.abs(combined.x-BASE_SPEED*100*.01)<1e-8);assert(Math.abs(combined.y-500-BASE_SPEED*40*.01)<1e-8,'Horizontal and vertical components are not normalized together');
const wings=new WindRider(new T.Scene());
wings.update(0,new T.Vector3(0,100,0),0,true,true,false,1);
const relaxed=wings.wings[0].wing.scale.x;
wings.update(1,new T.Vector3(0,100,0),0,true,true,true,1);
assert(wings.wings.every(w=>w.wing.scale.x<relaxed*.6));
assert(wings.wings.every(w=>Math.abs(w.wing.rotation.y)>.9),'Wings sweep aft');
wings.group.updateMatrixWorld(true);
const headForward=new T.Vector3(0,0,1).applyQuaternion(wings.head.getWorldQuaternion(new T.Quaternion()));
assert(Math.abs(headForward.y)<1e-6,'Head stays horizontal as neck extends');

const rect={left:50,top:70,width:1000,height:500};
assert.equal(mapPointer({clientX:60,clientY:200},rect),null,'Ignore letterbox margins');
const centre=mapPointer({clientX:550,clientY:320},rect);
assert(Math.abs(centre.worldX)<1e-8&&Math.abs(centre.worldZ)<1e-8);
assert.equal(coordinateText(-10000,-8000),'X 0 m · Y 0 m');

// A blocked direct line must route around the wall, not teleport or phase it.
const wall=(x,z)=>x>110&&x<210&&Math.abs(z)<130;
const route=await groundRoute([0,0],[400,0],{geo:flat,blocked:wall,cell:40,maxNodes:2000,yieldFrame:()=>Promise.resolve()});
assert(route&&route.points.length>2);
for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]));for(let k=0;k<=n;k++)assert(!wall(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n));}
// Horses avoid deep water; a walking character can retain its swim ability.
const wet={height:()=>0,waterAt:(x,z)=>Math.abs(x-200)<30&&Math.abs(z)<140?{depth:2}:null};
const horse=await groundRoute([0,0],[400,0],{geo:wet,riding:true,cell:40,yieldFrame:()=>Promise.resolve()});
assert(horse&&horse.points.some(p=>Math.abs(p[1])>=140));
const foot=await groundRoute([0,0],[400,0],{geo:wet,yieldFrame:()=>Promise.resolve()});assert.equal(foot.points.length,2);
let arrived=false;const auto=new AutoTravel({geo:flat,onFinish:()=>arrived=true});
await auto.begin({x:0,z:0},[300,0],'flight','测试点');
assert.equal(auto.route.mode,'flight');assert.equal(auto.direction({x:0,z:0}).distance,300);
assert.equal(auto.direction({x:300,z:0}),null);assert(arrived&&!auto.route);
await auto.begin({x:0,z:0},[200,0],'horse');auto.cancel();assert.equal(auto.route,null);
const abort=await groundRoute([0,0],[400,0],{geo:flat,blocked:wall,cancelled:()=>true,yieldFrame:()=>Promise.resolve()});assert.equal(abort,null);
console.log({speedUnitsAndPerModeLimits:'passed',previousSpeedChoices:'passed',sweptFlightAndBounds:'passed',sprintWingSweepAndHorizontalHead:'passed',letterboxClicksAndMetricCoordinates:'passed',groundDetourAndHorseWaterAvoidance:'passed',navigationArrivalAndCancellation:'passed',renderedBrowserFrames:'not tested'});
