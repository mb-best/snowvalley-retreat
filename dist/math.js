export function hash(x,z){let n=Math.sin(x*127.1+z*311.7)*43758.5453123;return n-Math.floor(n)}
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
export function noise(x,z){let i=Math.floor(x),j=Math.floor(z),a=x-i,b=z-j;a=a*a*(3-2*a);b=b*b*(3-2*b);return mix(mix(hash(i,j),hash(i+1,j),a),mix(hash(i,j+1),hash(i+1,j+1),a),b)}
export function fbm(x,z){let s=0,a=.5;for(let i=0;i<5;i++){s+=noise(x,z)*a;x=x*2.03+31.4;z=z*2.01-17.1;a*=.5}return s}
export function rng(seed=42){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const lake={x:105,z:-75,rx:98,rz:112,y:8.4};
export function lakeDistance(x,z){return Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz)}
export const streamX=z=>102+Math.sin(z*.018)*15+Math.sin(z*.007)*20;
const peaks=[[-330,-570,410,170,180],[-85,-650,540,140,210],[185,-680,490,180,200],[430,-510,390,180,180],[-580,-320,335,165,200],[665,-230,310,170,210],[-730,100,215,170,230],[760,250,210,180,230]];
function rawElevation(x,z){
 let h=12+(fbm(x*.009,z*.009)-.45)*17+(noise(x*.065,z*.065)-.5)*1.7;
 let mountain=0;for(const [px,pz,ph,sx,sz] of peaks){let d=((x-px)/sx)**2+((z-pz)/sz)**2;mountain=Math.max(mountain,Math.exp(-d*.65)*ph)}
 const ridge=.72+.22*(1-Math.abs(fbm(x*.014+20,z*.014)*2-1))+.12*noise(x*.045,z*.045);
 h+=mountain*ridge;
 // High-frequency ridges are confined to the mountains; the inhabited valley stays gentle.
 h+=smooth(25,170,mountain)*(fbm(x*.09,z*.09)-.45)*22;
 const village=smooth(85,30,Math.hypot(x+58,z-30));h=mix(h,12.4,village*.92);
 const d=lakeDistance(x,z);if(d<1.3){const bowl=lake.y-5.8*(1-smooth(.2,1.05,d));h=mix(h,bowl,1-smooth(.86,1.26,d))}
 if(z>15&&z<650){const w=Math.abs(x-streamX(z));const riverbed=lake.y-1.6;h=mix(h,riverbed,1-smooth(4.0,8.5,w))}
 return h;
}
let segments=370,heightCache=new Map();
export function configureTerrain(n){segments=n;heightCache.clear()}
function gridHeight(ix,iz){let k=ix+(segments+1)*iz;if(!heightCache.has(k))heightCache.set(k,rawElevation(ix/segments*2500-1250,iz/segments*2500-1250));return heightCache.get(k)}
// Match the exact triangles of the rendered mesh so trees, feet, and animals never float.
export function elevation(x,z){let gx=clamp((x+1250)/2500*segments,0,segments-.000001),gz=clamp((z+1250)/2500*segments,0,segments-.000001),ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz;let a=gridHeight(ix,iz),b=gridHeight(ix,iz+1),c=gridHeight(ix+1,iz+1),d=gridHeight(ix+1,iz);return fx+fz<=1?a+(d-a)*fx+(b-a)*fz:c+(b-c)*(1-fx)+(d-c)*(1-fz)}
export const destinations=[
 {id:'village',name:'雪隐村',sub:'木石小屋 · 炊烟与灯火',desc:'炊烟升起的地方，就是家。',x:-55,z:49,yaw:.1},
 {id:'meadow',name:'花溪草甸',sub:'牦牛牧场 · 野花与牧草',desc:'听牛铃轻响，看草叶随风。',x:-82,z:115,yaw:1.8},
 {id:'lake',name:'映雪海子',sub:'雪峰倒影 · 湖畔漫步',desc:'一汪碧色，盛下整座雪山。',x:15,z:5,yaw:-.85},
 {id:'forest',name:'听风松林',sub:'林间小径 · 蘑菇与蕨类',desc:'松针落下，山风有了形状。',x:-210,z:-130,yaw:.2},
 {id:'stream',name:'云溪木桥',sub:'山间溪流 · 木桥与卵石',desc:'让水声带走匆忙。',x:119,z:90,yaw:-1.57},
 {id:'summit',name:'望雪山脊',sub:'登山步道 · 高处的远方',desc:'走到云边，天地便开阔了。',x:-260,z:-470,yaw:3.05}
];
export const species=[{name:'高原牧草',note:'喂给牦牛的心意',color:0x8ba85e,season:[0,1,2]},{name:'蓝花龙胆',note:'草甸上安静的蓝色',color:0x7197dc,season:[0,1]},{name:'野生蘑菇',note:'松林里雨后的礼物',color:0xbf8659,season:[1,2]},{name:'雪山银莲花',note:'高处也有温柔生长',color:0xe8e1c4,season:[0,1,3]}];

