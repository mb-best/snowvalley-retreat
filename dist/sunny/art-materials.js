import * as T from '../vendor/three.module.js';
import {random} from './terrain.js?v=2';

export const artTime={value:0};
const textureLoader=new T.TextureLoader();
const shaderNoise=`
float artHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float artNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(artHash(i),artHash(i+vec3(1,0,0)),f.x),mix(artHash(i+vec3(0,1,0)),artHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(artHash(i+vec3(0,0,1)),artHash(i+vec3(1,0,1)),f.x),mix(artHash(i+vec3(0,1,1)),artHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float artFbm(vec3 p){return artNoise(p)*.57+artNoise(p*2.08+9.3)*.28+artNoise(p*4.17-3.5)*.15;}
`;
function surfaceCoordinates(shader){
  shader.vertexShader='varying vec3 vArtPosition;varying vec3 vArtNormal;varying vec3 vArtLocal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec4 artP=vec4(transformed,1.0);
    #ifdef USE_INSTANCING
      artP=instanceMatrix*artP;
    #endif
    vArtPosition=(modelMatrix*artP).xyz;
    vArtNormal=inverseTransformDirection(transformedNormal,viewMatrix);
    vArtLocal=position;
    #include <project_vertex>`);
  shader.fragmentShader='varying vec3 vArtPosition;varying vec3 vArtNormal;varying vec3 vArtLocal;\n'+shaderNoise+shader.fragmentShader;
}
export function stoneMaterial(){
  const material=new T.MeshStandardMaterial({color:'#d1d0c2',roughness:.98,metalness:0});
  material.extensions={derivatives:true};
  material.onBeforeCompile=shader=>{
    surfaceCoordinates(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 rockP=vArtPosition;
      float broad=artFbm(rockP*1.25);
      float grain=artNoise(rockP*36.0);
      float fissure=1.0-smoothstep(.015,.075,abs(artNoise(rockP*3.8+artFbm(rockP)*2.0)-.49));
      float seam=1.0-smoothstep(.015,.055,abs(fract(rockP.y*.69+artFbm(rockP*2.0)*.47)-.51));
      vec3 mineral=mix(vec3(.27,.30,.30),vec3(.64,.61,.53),broad);
      mineral*=.94+grain*.12;
      mineral=mix(mineral,mineral*.57,fissure*.36);
      mineral=mix(mineral,vec3(.72,.70,.60),seam*.20);
      float wet=1.0-smoothstep(.12,.85,rockP.y-(.22-rockP.z*.008));
      mineral*=1.0-wet*.34;
      float north=(dot(normalize(vArtNormal),normalize(vec3(-.3,.85,-.25)))+1.0)*.5;
      float mossBoundary=artFbm(rockP*2.1+vec3(0,1,0))*.62+artNoise(rockP*8.5)*.16;
      float moss=smoothstep(.65,.85,mossBoundary+north*.40)*smoothstep(-.26,.55,vArtNormal.y);
      moss*=1.0-wet*.58;
      vec3 mossTint=mix(vec3(.15,.28,.085),vec3(.40,.49,.16),artNoise(rockP*14.0)*.68+broad*.32);
      float mossTips=smoothstep(.70,.91,artNoise(rockP*53.0));
      mossTint+=mossTips*vec3(.075,.085,.035);
      diffuseColor.rgb=mix(mineral,mossTint,moss*.92)*diffuseColor.rgb*1.66;
      float lichen=smoothstep(.76,.92,artNoise(rockP*18.0))*smoothstep(.62,.80,artNoise(rockP*3.1));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.62,.46),lichen*.32);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float relief=artFbm(vArtPosition*9.0)*.026+artNoise(vArtPosition*43.0)*.004;
      vec3 sigmaX=dFdx(-vViewPosition),sigmaY=dFdy(-vViewPosition);
      vec3 r1=cross(sigmaY,normal),r2=cross(normal,sigmaX);
      float determinant=dot(sigmaX,r1);
      normal=normalize(abs(determinant)*normal-sign(determinant)*(dFdx(relief)*r1+dFdy(relief)*r2));`);
  };
  material.customProgramCacheKey=()=> 'sunny-stone-moss-v2';
  return material;
}
let barkColor,barkNormal;
export function barkMaterial(birch=false){
  if(!barkColor){barkColor=textureLoader.load('./sunny/assets/bark-color.jpg');barkColor.colorSpace=T.SRGBColorSpace;barkColor.wrapS=barkColor.wrapT=T.RepeatWrapping;barkColor.anisotropy=4;barkNormal=textureLoader.load('./sunny/assets/bark-normal.jpg');barkNormal.wrapS=barkNormal.wrapT=T.RepeatWrapping;barkNormal.anisotropy=4;}
  const material=new T.MeshStandardMaterial({color:birch?'#eee9d8':'#c4b498',map:barkColor,normalMap:barkNormal,normalScale:new T.Vector2(.36,.36),roughness:1});
  material.onBeforeCompile=shader=>{
    surfaceCoordinates(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',birch?`sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,vec3(.65,.66,.59),.75);diffuseColor*=sampledDiffuseColor;`:`sampledDiffuseColor.rgb=mix(vec3(.34,.29,.22),sampledDiffuseColor.rgb,.62);diffuseColor*=sampledDiffuseColor;`));
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float barkStreak=artNoise(vec3(vArtLocal.x*13.0,vArtLocal.y*.8,vArtLocal.z*13.0));
      diffuseColor.rgb*=mix(.83,1.14,barkStreak);
      float rootShade=1.0-smoothstep(.2,2.6,vArtLocal.y);
      float barkMoss=smoothstep(.44,.68,artFbm(vArtPosition*4.0)+rootShade*.32)*rootShade;
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.29,.095),barkMoss*.64);
      float speck=smoothstep(.79,.93,artNoise(vArtPosition*35.0))*smoothstep(.57,.74,artNoise(vArtPosition*5.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.48,.35),speck*.43);`);
  };
  material.customProgramCacheKey=()=> 'sunny-bark-v2-'+birch;
  return material;
}
export function paintedLeafTexture(){
  const rnd=random(71),c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  function leaf(x,y,length,width,angle,tone){ctx.save();ctx.translate(x,y);ctx.rotate(angle);let gradient=ctx.createLinearGradient(-width,0,width,0);gradient.addColorStop(0,`rgb(${tone-35},${tone-26},${tone-48})`);gradient.addColorStop(.48,`rgb(${tone},${tone},${tone-13})`);gradient.addColorStop(1,`rgb(${tone-16},${tone-10},${tone-25})`);ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(0,length*.50);ctx.bezierCurveTo(-width,length*.1,-width*.76,-length*.42,0,-length*.54);ctx.bezierCurveTo(width*.76,-length*.42,width,length*.1,0,length*.50);ctx.fill();ctx.strokeStyle='rgba(248,251,213,.24)';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(0,length*.38);ctx.quadraticCurveTo(-2,0,0,-length*.44);ctx.stroke();ctx.restore()}
  for(let i=0;i<112;i++){let a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*191,x=256+Math.cos(a)*r,y=256+Math.sin(a)*r*.82;leaf(x,y,42+rnd()*45,11+rnd()*17,a*.5+rnd()*2,180+Math.floor(rnd()*65))}
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function leafMaterial(texture){
  const material=new T.MeshStandardMaterial({color:0xffffff,map:texture,alphaTest:.42,alphaToCoverage:true,side:T.DoubleSide,roughness:.98,emissive:'#4b6931',emissiveIntensity:.10});
  material.onBeforeCompile=shader=>{
    surfaceCoordinates(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','sampledDiffuseColor.rgb=mix(vec3(1.0),sampledDiffuseColor.rgb,.48);diffuseColor*=sampledDiffuseColor;'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float brush=artNoise(vArtPosition*8.0)*.6+artNoise(vArtPosition*19.0)*.4;
      diffuseColor.rgb*=mix(vec3(.78,.91,.80),vec3(1.16,1.13,.91),brush);
      float sunEdge=pow(max(0.0,dot(normalize(vArtNormal),normalize(vec3(-.4,.8,.2)))),2.0);
      diffuseColor.rgb+=sunEdge*vec3(.025,.027,.006);`);
  };material.customProgramCacheKey=()=> 'sunny-painted-leaf-v2';return material;
}
export function groundPaint(material){
  material.onBeforeCompile=shader=>{surfaceCoordinates(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float broadPaint=artFbm(vArtPosition*vec3(.62,.4,.62));
    float finePaint=artNoise(vArtPosition*11.0);
    diffuseColor.rgb*=mix(vec3(.82,.90,.77),vec3(1.07,1.04,.90),broadPaint);
    diffuseColor.rgb*=.96+finePaint*.07;
    float smallLeaves=smoothstep(.79,.94,artNoise(vArtPosition*21.0));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.76,.88,.68),smallLeaves*.16);`)};
  material.customProgramCacheKey=()=> 'sunny-painted-ground-v2';return material;
}
export function woodMaterial(tint='#a58a62'){
  const m=new T.MeshStandardMaterial({color:tint,roughness:.94});m.extensions={derivatives:true};
  m.onBeforeCompile=shader=>{surfaceCoordinates(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 wp=vArtPosition;
    float timberWarp=artFbm(wp*1.9)*1.4;
    float grain=sin(wp.y*1.1+wp.x*28.0+wp.z*26.0+timberWarp*5.0);
    float fiber=artNoise(wp*vec3(65.0,4.0,65.0));
    diffuseColor.rgb*=.88+.12*grain+.10*fiber;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.77,.84,.81),smoothstep(.58,.82,artNoise(wp*2.0))*.26);`)};m.customProgramCacheKey=()=> 'sunny-aged-wood-v2';return m;
}
export function clayMaterial(){
  const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.96});m.onBeforeCompile=shader=>{surfaceCoordinates(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float clayGrain=artNoise(vArtPosition*41.0);
    float weathered=artFbm(vArtPosition*2.9);
    diffuseColor.rgb*=.85+clayGrain*.13+weathered*.17;
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.79,.87,.78),smoothstep(.68,.84,weathered)*.26);`)};m.customProgramCacheKey=()=> 'sunny-clay-v2';return m;
}
export function cloudTexture(seed=12){
  const rnd=random(seed),c=document.createElement('canvas');c.width=1024;c.height=384;let ctx=c.getContext('2d');
  // Soft overlapping painted lobes, with a cool lower edge and warm sunlit tops.
  for(let layer=0;layer<3;layer++)for(let i=0;i<95;i++){let x=110+rnd()*800,y=175+Math.sin(x*.011)*28+(rnd()-.5)*55-layer*26,r=35+rnd()*65;let g=ctx.createRadialGradient(x,y,r*.12,x,y,r);let col=layer===0?'158,187,197':layer===1?'231,237,225':'255,252,231';g.addColorStop(0,'rgba('+col+',.70)');g.addColorStop(.73,'rgba('+col+',.55)');g.addColorStop(1,'rgba('+col+',0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
  let t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
