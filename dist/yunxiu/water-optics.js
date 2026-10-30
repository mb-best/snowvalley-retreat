import * as T from'../vendor/three.module.js';
import{clamp}from'./core.js';
import{LAKE_DEPTH}from'./hydrology.js';

export function depthTexture(geo,lake,size=64){const b=lake.bounds,data=new Uint8Array(size*size*4);for(let j=0;j<size;j++)for(let i=0;i<size;i++){const x=b[0]+(b[2]-b[0])*(i+.5)/size,z=b[1]+(b[3]-b[1])*(j+.5)/size,w=geo.waterAt(x,z);if(w&&w.feature.id===lake.feature.id){const k=(j*size+i)*4;data[k]=Math.round(clamp((w.height-geo.height(x,z))/LAKE_DEPTH,0,1)*255);data[k+3]=255;}}const texture=new T.DataTexture(data,size,size,T.RGBAFormat);texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;return{texture,bounds:new T.Vector4(b[0],b[1],b[2]-b[0],b[3]-b[1])};}
export const lakeOpticsGLSL=`
 uniform sampler2D uLakeDepth;
 uniform vec4 uLakeBounds;
 uniform vec3 uWaterEye;
 float lakeDepthAt(vec2 p){return texture2D(uLakeDepth,(p-uLakeBounds.xy)/uLakeBounds.zw).r;}
 float lakeCoverAt(vec2 p){return texture2D(uLakeDepth,(p-uLakeBounds.xy)/uLakeBounds.zw).a;}
 vec3 lakeTint(float depth){return mix(vec3(.36,.66,.56),vec3(.055,.31,.37),smoothstep(.03,.92,depth));}
 float waterFresnel(vec3 p){vec3 eye=normalize(uWaterEye-p);return .035+.72*pow(1.-abs(eye.y),4.);}
 `;

export function configureLakeMaterial(material,depth,time,cutShader=''){
 material.userData.lakeDepth=depth;material.transparent=true;material.depthWrite=false;material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;material.roughness=.19;material.metalness=0;material.opacity=.65;
 material.onBeforeCompile=s=>{s.uniforms.uWaterTime=time;s.uniforms.uLakeDepth={value:depth.texture};s.uniforms.uLakeBounds={value:depth.bounds};s.uniforms.uWaterEye={value:material.userData.eye};s.vertexShader='varying vec3 vLakeSurface;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLakeSurface=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='varying vec3 vLakeSurface;uniform float uWaterTime;\n'+lakeOpticsGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${cutShader.replaceAll('vWater.xz','vLakeSurface.xz')}float coverage=lakeCoverAt(vLakeSurface.xz);if(coverage<.025)discard;float depth=lakeDepthAt(vLakeSurface.xz),fresnel=waterFresnel(vLakeSurface),wave=sin(vLakeSurface.x*.39+uWaterTime*1.1)*sin(vLakeSurface.z*.43-uWaterTime*.8);diffuseColor.rgb=mix(lakeTint(depth),vec3(.65,.83,.82),fresnel*.5)+wave*.015;diffuseColor.a=(mix(.12,.68,smoothstep(0.,.75,depth))+.16*fresnel)*smoothstep(.025,.8,coverage);`);s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(sin(vLakeSurface.x*.65+uWaterTime)*.07,cos(vLakeSurface.z*.58-uWaterTime)*.07,0.));');};
 material.userData.eye=new T.Vector3();material.customProgramCacheKey=()=> 'yunxiu-depth-lake-v3';
}

export function configureReflection(mirror,depth,time,cutShader){
 const m=mirror.material;m.transparent=true;m.depthWrite=false;m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-1;
 m.uniforms.uWaterTime=time;m.uniforms.uLakeDepth={value:depth.texture};m.uniforms.uLakeBounds={value:depth.bounds};m.uniforms.uWaterEye={value:new T.Vector3()};
 m.vertexShader='varying vec3 vLakeSurface;\n'+m.vertexShader.replace('vUv = textureMatrix * vec4( position, 1.0 );','vUv = textureMatrix * vec4( position, 1.0 );vLakeSurface=(modelMatrix*vec4(position,1.)).xyz;');
 m.fragmentShader='varying vec3 vLakeSurface;uniform float uWaterTime;\n'+lakeOpticsGLSL+m.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );',`${cutShader.replaceAll('vWater.xz','vLakeSurface.xz')}
 float coverage=lakeCoverAt(vLakeSurface.xz);if(coverage<.025)discard;vec4 q=vUv;vec2 ripple=vec2(sin(vLakeSurface.z*.32+uWaterTime*.7),cos(vLakeSurface.x*.35-uWaterTime*.6));q.xy+=ripple*.0007*q.w;vec4 base=texture2DProj(tDiffuse,q);float depth=lakeDepthAt(vLakeSurface.xz),fresnel=waterFresnel(vLakeSurface);base.rgb=mix(lakeTint(depth),base.rgb,clamp(fresnel,.035,.78));`)
 .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','gl_FragColor=vec4(base.rgb,(mix(.12,.72,smoothstep(0.,.75,depth))+.17*fresnel)*smoothstep(.025,.8,coverage));');
}
