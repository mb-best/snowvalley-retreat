import {hash2,erosionNoise} from './vendor/tidewater/TerrainNoise.js';
// Unmodified Tidewater CPU erosion helpers, MIT; see vendor/tidewater/LICENSE.txt.
export const ALT_BASE=2000;
export const WORLD={minX:-8192,maxX:8192,minZ:-18432,maxZ:2048,width:16384,height:20480,grid:8};
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export const hash=(x,z)=>hash2(x,z,71);
export function noise(x,z){let i=Math.floor(x),j=Math.floor(z),a=x-i,b=z-j;a=a*a*(3-2*a);b=b*b*(3-2*b);return mix(mix(hash(i,j),hash(i+1,j),a),mix(hash(i,j+1),hash(i+1,j+1),a),b)}
export function fbm(x,z){let s=0,a=.5;for(let i=0;i<5;i++){s+=noise(x,z)*a;x=x*2.03+31.4;z=z*2.01-17.1;a*=.5}return s}
export function rng(seed=42){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const PROFILE=[[-18432,100],[-17400,30],[-15800,0],[-15000,40],[-13500,250],[-12000,700],[-10500,1200],[-9300,1600],[-8500,1800],[-8100,1720],[-7400,1450],[-6800,1200],[-5900,1200],[-5000,900],[-3500,400],[-2000,100],[0,0],[2048,0]];
export function profileHeight(z){if(z<=PROFILE[0][0])return PROFILE[0][1];for(let i=1;i<PROFILE.length;i++){let [b,v]=PROFILE[i],[a,u]=PROFILE[i-1];if(z<=b)return mix(u,v,smooth(a,b,z))}return PROFILE.at(-1)[1]}
const ROUTE=[[-15800,-320],[-14600,40],[-13500,-140],[-12000,320],[-10500,-260],[-9300,230],[-8500,0],[-8100,-160],[-7400,240],[-6800,-160],[-5900,-40],[-5000,-250],[-3500,210],[-2000,-230],[0,-55],[1000,-55]];
export function trailX(z){if(z<=ROUTE[0][0])return ROUTE[0][1];for(let i=1;i<ROUTE.length;i++){let [b,v]=ROUTE[i],[a,u]=ROUTE[i-1];if(z<=b)return mix(u,v,smooth(a,b,z))}return ROUTE.at(-1)[1]}
export const trailDistance=(x,z)=>Math.abs(x-trailX(z));
export const lake={x:550,z:-6300,rx:380,rz:420,y:1200};
export const lakeDistance=(x,z)=>Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz);
export const waterfall={x:900,z:-14520,width:26,name:'云落瀑布'};
export const streamX=z=>mix(550,140,smooth(-5880,0,z))+Math.sin((z+5880)*.0012)*36*smooth(-5880,-5200,z);
export const riverSurface=z=>profileHeight(Math.min(z,0))-2+2*(1-smooth(-5880,-5600,z));
export const farStreamX=z=>900+Math.sin((z+14520)*.002)*35;
export const farRiverSurface=z=>profileHeight(z)-2+110*smooth(-14550,-14490,z);
function envelope(x,z){let h=profileHeight(z),lateral=smooth(350,1900,Math.abs(x));let east=Math.exp(-(((x-2600)/1900)**2+((z+8500)/2150)**2))*1200,west=Math.exp(-(((x+2900)/2100)**2+((z+8500)/2400)**2))*1110;h+=Math.max(east,west)*lateral;h+=smooth(500,7500,Math.abs(x))*(180+Math.sin(z*.0006+1)*110)*(1-smooth(10500,15000,Math.abs(z+8000)));return h}
function rawElevation(x,z){
 let h=envelope(x,z),quiet=1-smooth(100,300,Math.min(Math.hypot(x+58,z-30),Math.hypot(x+320,z+15800))),route=1-smooth(12,75,trailDistance(x,z));
 let relief=(fbm(x*.0015,z*.0011)-.48)*(38+smooth(300,1800,h)*42)+(noise(x*.009,z*.009)-.5)*5;
 if(h>700){let gx=(envelope(x+20,z)-envelope(x-20,z))/40,gz=(envelope(x,z+20)-envelope(x,z-20))/40;relief+=erosionNoise(x,z,gx,gz,2,240,28)*smooth(700,1800,h)}
 h+=relief*(1-quiet)*(1-route*.7);
 h+=(fbm(x*.0021+8,z*.0018-5)-.48)*220*smooth(1400,2200,h)*smooth(450,1600,Math.abs(x));
 const d=lakeDistance(x,z);if(d<1.8)h=mix(h,lake.y+clamp(d-1,-1,.8)*32,1-smooth(1.28,1.8,d));
 if(z>=-5880&&z<900){let d=Math.abs(x-streamX(z)),water=riverSurface(z);if(d<22)h=mix(h,water-1.5+smooth(4,13,d)*4,1-smooth(14,22,d))}
 let ledge=(1-smooth(160,480,Math.abs(x-waterfall.x)))*smooth(-14550,-14490,z)*(1-smooth(-13700,-13300,z));h+=110*ledge;
 if(z>-16400&&z<-13900){let d=Math.abs(x-farStreamX(z));if(d<19)h=mix(h,farRiverSurface(z)-1.5+smooth(5,12,d)*4,1-smooth(13,19,d))}
 let pool=Math.hypot((x-waterfall.x)/60,(z+14600)/45);if(pool<1.35)h=mix(h,farRiverSurface(-14600)+(pool-1)*8,1-smooth(1,1.35,pool));
 for(const [ax,az,ay,inner,outer] of [[-58,30,0,120,230],[-320,-15800,0,160,310],[0,-8500,1800,45,190],[2600,-8500,3000,35,135]]){let t=1-smooth(inner,outer,Math.hypot(x-ax,z-az));h=mix(h,ay,t)}
 return Math.min(3000,h);
}
const NX=WORLD.width/WORLD.grid+1,NZ=WORLD.height/WORLD.grid+1,cache=new Float32Array(NX*NZ),known=new Uint8Array(NX*NZ);
export function configureTerrain(){known.fill(0)}
function gridHeight(ix,iz){let key=ix+NX*iz;if(!known[key]){cache[key]=rawElevation(WORLD.minX+ix*WORLD.grid,WORLD.minZ+iz*WORLD.grid);known[key]=1}return cache[key]}
export function elevation(x,z){let gx=clamp((x-WORLD.minX)/WORLD.grid,0,WORLD.width/WORLD.grid-.000001),gz=clamp((z-WORLD.minZ)/WORLD.grid,0,WORLD.height/WORLD.grid-.000001),ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,a=gridHeight(ix,iz),b=gridHeight(ix,iz+1),c=gridHeight(ix+1,iz+1),d=gridHeight(ix+1,iz);return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz)}
export const biomes=[
 {id:'forest',name:'茂密山地森林',min:2000,max:2600,color:'#496c52',desc:'溪谷深深，林荫连绵。'},
 {id:'conifer',name:'稀疏针叶林',min:2600,max:3200,color:'#819275',desc:'松林渐疏，天空渐渐开阔。'},
 {id:'meadow',name:'高山灌丛与花甸',min:3200,max:3550,color:'#aaa574',desc:'低矮的灌木与野花，在风中舒展。'},
 {id:'rock',name:'高山岩石坡地',min:3550,max:4100,color:'#a5a49a',desc:'岩坡与碎石之间，古道穿过山脊。'},
 {id:'snow',name:'雪线之上',min:4100,max:5001,color:'#e4e9e5',desc:'风掠过积雪，群峰在云上安静伫立。'}
];
export function biomeAt(x,z){let alt=ALT_BASE+elevation(x,z);return biomes.find(b=>alt<b.max)||biomes.at(-1)}
export const destinations=[
 {id:'village',name:'雪隐村',sub:'2,000 m · 山前村庄',desc:'山在远处，日子在身旁。',x:-55,z:49,yaw:0},
 {id:'meadow',name:'花溪牧场',sub:'2,000 m · 牦牛与野花',desc:'听牛铃轻响，看草叶随风。',x:-82,z:115,yaw:1.8},
 {id:'forest',name:'听风密林',sub:'2,300 m · 山地森林',desc:'溪水与鸟鸣，在层层林荫里相遇。',x:trailX(-3050),z:-3050,yaw:0},
 {id:'stream',name:'云溪木桥',sub:'2,050 m · 溪谷旧桥',desc:'让水声带走匆忙。',x:streamX(-1200)-12,z:-1200,yaw:-1.57},
 {id:'pine',name:'疏松山坡',sub:'2,900 m · 稀疏针叶林',desc:'松树之间，开始看见远方的雪。',x:trailX(-5000),z:-5000,yaw:0},
 {id:'lake',name:'映雪海子',sub:'3,200 m · 林线与花甸之间',desc:'一汪碧色，盛下整座雪山。',x:95,z:-6240,yaw:-1.4},
 {id:'flowers',name:'云边花甸',sub:'3,350 m · 灌丛与鲜花',desc:'在宽阔的高山草甸，慢慢等一朵云。',x:trailX(-7150),z:-7150,yaw:0},
 {id:'talus',name:'叠石古道',sub:'3,650 m · 缓起的岩石坡',desc:'一层山坡，一段古道，一步一步靠近天空。',x:trailX(-7950),z:-7950,yaw:0},
 {id:'pass',name:'望雪垭口',sub:'3,800 m · 通往山的另一侧',desc:'越过山口，另一座村庄在更远的谷地等你。',x:0,z:-8500,yaw:0},
 {id:'summit',name:'照雪峰',sub:'5,000 m · 常年积雪的峰顶',desc:'天地开阔，群山无言。',x:2600,z:-8500,yaw:2.5},
 {id:'northmeadow',name:'北坡晴甸',sub:'3,200 m · 山后的开阔草甸',desc:'翻过垭口，山风换了一个方向。',x:trailX(-10500),z:-10500,yaw:0},
 {id:'waterfall',name:'云落瀑布',sub:'约 2,100 m · 百米飞瀑',desc:'云落成水，水声在山谷里有了回响。',x:730,z:-14730,yaw:-2.5,pitch:.16},
 {id:'northvillage',name:'听澜村',sub:'2,000 m · 山后溪谷村庄',desc:'翻山而来，在水声里住下。',x:-320,z:-15750,yaw:0}
];
export const species=[{name:'高原牧草',note:'喂给牦牛的心意',color:0x8ba85e,season:[0,1,2]},{name:'蓝花龙胆',note:'草甸上安静的蓝色',color:0x7197dc,season:[0,1]},{name:'野生蘑菇',note:'密林里雨后的礼物',color:0xbf8659,season:[1,2]},{name:'雪山银莲花',note:'高处也有温柔生长',color:0xe8e1c4,season:[0,1,3]}];
