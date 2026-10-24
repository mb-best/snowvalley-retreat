import * as T from '../vendor/three.module.js';
import {random,noise,groundHeight,riverX,riverWidth,pathDistance,clamp,bareRock} from './terrain.js?v=2';
import {artTime} from './art-materials.js?v=2';
const rnd=random(368),dummy=new T.Object3D(),color=new T.Color(),TAU=Math.PI*2;
export const windTime=artTime;
export function join(geometries){const pos=[],norm=[],uv=[],colors=[];for(const g of geometries){const a=g.index?g.toNonIndexed():g;pos.push(...a.attributes.position.array);norm.push(...a.attributes.normal.array);if(a.attributes.uv)uv.push(...a.attributes.uv.array);if(a.attributes.color)colors.push(...a.attributes.color.array)}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));if(uv.length===pos.length/3*2)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));if(colors.length===pos.length)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g}
export function makeMesh(g,m,parent,x=0,y=0,z=0){let o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
export const matte=(c)=>new T.MeshLambertMaterial({color:c});
export function beam(parent,a,b,r1,r2,material,segments=7){let av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av),m=makeMesh(new T.CylinderGeometry(r2,r1,delta.length(),segments),material,parent);m.position.copy(av).add(bv).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return m}
export function breeze(material,strength=.18,grass=false){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous(shader);
    shader.uniforms.uWindTime=windTime;
    shader.vertexShader='uniform float uWindTime; varying float vPlantY;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 plantOrigin = vec4(0.0,0.0,0.0,1.0);
      #ifdef USE_INSTANCING
        plantOrigin = instanceMatrix * plantOrigin;
      #endif
      float plantPhase = plantOrigin.x*.31+plantOrigin.z*.21;
      float bend = sin(uWindTime*1.4+plantPhase)+.4*sin(uWindTime*2.6+plantPhase*.7);
      transformed.x += bend * ${strength.toFixed(3)} * ${grass?'pow(max(position.y,0.0),2.0)':'max(position.y*.06+.3,0.0)'};
      transformed.z += cos(uWindTime+plantPhase)*${(strength*.45).toFixed(3)}*max(position.y,0.0);
      vPlantY=position.y;`);
    if(grass){shader.fragmentShader='varying float vPlantY;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(.78,.87,.65), vec3(1.12,1.08,.86), clamp(vPlantY*1.8,0.0,1.0));')}
  };
  material.customProgramCacheKey=()=>`sunny-breeze-${strength}-${grass}`;
}
export function addGrass(scene,lightweight=false){
  const triangles=[];
  for(let j=0;j<3;j++){
    let g=new T.BufferGeometry(),w=.025+j*.006,h=.39+j*.065;
    g.setAttribute('position',new T.Float32BufferAttribute([-w,0,0,w,0,0,-w*.70,h*.40,-.012,w*.70,h*.40,-.012,-w*.32,h*.76,-.055,w*.32,h*.76,-.055,.035,h,-.13],3));
    g.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);g.computeVertexNormals();let nn=g.attributes.normal;for(let k=0;k<nn.count;k++){let v=new T.Vector3(nn.getX(k)*.4,.8,nn.getZ(k)*.4).normalize();nn.setXYZ(k,v.x,v.y,v.z)}g.rotateY(j*2.09);g.translate(Math.cos(j*2.09)*.07,0,Math.sin(j*2.09)*.07);triangles.push(g);
  }
  const material=new T.MeshLambertMaterial({color:0xffffff,side:T.DoubleSide});breeze(material,.20,true);
  const count=lightweight?24000:55000,mesh=new T.InstancedMesh(join(triangles),material,count);
  let i=0,attempt=0;const palette=['#79ad40','#88b546','#71a43d','#9abe51','#85b148'];
  while(i<count&&attempt++<count*9){let near=rnd()<.76,x=(rnd()-.5)*(near?118:190),z=(near?-62:-125)+rnd()*(near?147:230);
    if(Math.abs(x-riverX(z))<riverWidth(z)+1.15||pathDistance(x,z)<1.9||Math.abs(x+19)<5.2&&Math.abs(z+19)<5.4||bareRock(x,z,.25))continue;
    if(noise(x*.13,z*.13)<-.48&&rnd()<.84)continue;
    let size=.6+rnd()*.65;dummy.position.set(x,groundHeight(x,z)-.025,z);dummy.rotation.set(0,rnd()*TAU,0);dummy.scale.setScalar(size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(palette[Math.floor(rnd()*palette.length)]));i++;
  }
  mesh.count=i;mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;scene.add(mesh);return mesh;
}
function petalGeometry(petals=6){const parts=[];for(let i=0;i<petals;i++){let a=i/petals*TAU,g=new T.SphereGeometry(1,9,5);g.scale(.07,.022,.15);g.rotateY(a);g.translate(Math.sin(a)*.12,.015,Math.cos(a)*.12);parts.push(g)}return join(parts)}
export function addFlowers(scene){
  const all=[],patches=[{x:25,z:-6,r:15,c:0,n:780},{x:36,z:-18,r:14,c:1,n:570},{x:17,z:23,r:11,c:2,n:410},{x:-12,z:-3,r:7,c:2,n:180},{x:-28,z:-11,r:9,c:3,n:280},{x:32,z:9,r:10,c:3,n:360},{x:-19,z:38,r:11,c:1,n:250}];
  for(const p of patches)for(let i=0;i<p.n*1.35;i++){let a=rnd()*TAU,r=Math.sqrt(rnd())*p.r,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(Math.abs(x-riverX(z))<riverWidth(z)+1.3||pathDistance(x,z)<1.75||Math.abs(x+19)<5&&Math.abs(z+19)<5.1)continue;if(noise(x*.45,z*.45)<-.2&&rnd()<.7)continue;all.push({x,z,y:groundHeight(x,z),h:.30+rnd()*.46,s:.6+rnd()*.65,type:(rnd()<.82?p.c:Math.floor(rnd()*4)),phase:rnd()*TAU})}
  const colors=['#e88ba9','#a49bd4','#fff5d0','#efc652'],stems=new T.InstancedMesh(new T.CylinderGeometry(.009,.013,1,5),matte('#638e3b'),all.length);
  for(let i=0;i<all.length;i++){let p=all[i];dummy.position.set(p.x,p.y+p.h/2,p.z);dummy.rotation.set(0,0,.05);dummy.scale.set(1,p.h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix)}stems.receiveShadow=true;scene.add(stems);
  for(let t=0;t<4;t++){let rows=all.filter(p=>p.type===t),mat=matte(colors[t]);breeze(mat,.028);mat.side=T.DoubleSide;let heads=new T.InstancedMesh(petalGeometry(t===2?8:5),mat,rows.length),centers=new T.InstancedMesh(new T.SphereGeometry(.095,7,5).scale(1,.55,1),matte(t===3?'#b87830':'#e6b83e'),rows.length);
    for(let i=0;i<rows.length;i++){let p=rows[i];dummy.position.set(p.x,p.y+p.h,p.z);dummy.rotation.set((rnd()-.5)*.8,p.phase,(rnd()-.5)*.7);dummy.scale.setScalar(p.s);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);dummy.position.y+=.035;dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix)}heads.receiveShadow=true;centers.receiveShadow=true;scene.add(heads,centers);
  }
  return all.length;
}
export function addTrees(scene){
  const bark=matte('#8d7650'),barkLight=matte('#a48c62'),trees=[],colliders=[];
  const fixed=[[-40,25,1.25],[44,22,1.23],[-36,-12,1.02],[-28,-35,1.1],[-9,-42,1.18],[6,-51,1.12],[36,-37,1.10],[49,-12,.92],[-46,-45,1.1],[-54,-4,1.3]];
  for(const [x,z,s] of fixed)trees.push({x,z,s});
  for(let i=0;i<55;i++){let x=(rnd()-.5)*220,z=-65-rnd()*110;if(Math.abs(x-riverX(z))<8)continue;trees.push({x,z,s:.76+rnd()*.65})}
  for(let i=0;i<15;i++){let x=(rnd()<.5?-1:1)*(52+rnd()*40),z=-35+rnd()*120;trees.push({x,z,s:.8+rnd()*.65})}
  const crowns=[],sprigs=[],palette=['#689f46','#7dae4e','#8ab94d','#a0c45a','#71a94b','#80b251','#95bd56'];
  for(let i=0;i<trees.length;i++){
    const tree=trees[i],root=new T.Group(),s=tree.s,h=7.3+rnd()*1.8;root.position.set(tree.x,groundHeight(tree.x,tree.z)-.08,tree.z);root.scale.setScalar(s);scene.add(root);colliders.push({x:tree.x,z:tree.z,r:s*.58});
    beam(root,[0,0,0],[.16,h*.72,-.12],.48,.19,i%3===0?barkLight:bark,8);
    for(let k=0;k<7;k++){let a=k/7*TAU+.4*rnd(),start=3.2+k*.38,end=[Math.cos(a)*(2.2+rnd()),h-.7+rnd()*1.1,Math.sin(a)*(2.1+rnd())];beam(root,[.1,start,0],end,.18,.045,bark);beam(root,end,[end[0]*1.25,end[1]+.75,end[2]*1.25],.055,.012,bark,5)}
    const branchParts=[];for(const child of [...root.children]){child.updateMatrix();branchParts.push(child.geometry.clone().applyMatrix4(child.matrix));root.remove(child);child.geometry.dispose()}makeMesh(join(branchParts),i%3===0?barkLight:bark,root);branchParts.forEach(g=>g.dispose());
    for(let k=0;k<19;k++){let a=k*2.4,r=Math.sqrt(rnd())*3.8,dx=Math.cos(a)*r,dz=Math.sin(a)*r,dy=h+.9-r*.23+rnd()*1.7,sz=1.1+rnd()*.7;crowns.push({x:tree.x+dx*s,y:root.position.y+dy*s,z:tree.z+dz*s,sx:sz*s,sy:(.8+rnd()*.7)*s,sz:sz*(.9+rnd()*.4)*s,c:palette[(i+k)%palette.length]})}
    for(let k=0;k<100;k++){let a=rnd()*TAU,r=(1.9+rnd()*2.8),dx=Math.cos(a)*r,dz=Math.sin(a)*r,dy=h+1.1-r*.18+(rnd()-.4)*2.8;sprigs.push({x:tree.x+dx*s,y:root.position.y+dy*s,z:tree.z+dz*s,s:(1.4+rnd()*.8)*s,a:rnd()*TAU,b:(rnd()-.5)*1.8,c:palette[(i+k)%palette.length]})}
  }
  let geo=new T.IcosahedronGeometry(1,2),pos=geo.attributes.position,norm=geo.attributes.normal;for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),v=1+.065*noise(x*5+z*3,y*5),l=Math.hypot(x,y,z);pos.setXYZ(i,x*v,y*v,z*v);norm.setXYZ(i,x/l,y/l,z/l)}
  const crownMat=matte('#ffffff');breeze(crownMat,.025);const crownWind=crownMat.onBeforeCompile;crownMat.onBeforeCompile=shader=>{crownWind(shader);shader.vertexShader='varying vec3 vCrownPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vCrownPosition=(instanceMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');shader.fragmentShader=`varying vec3 vCrownPosition;
    float leafHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float leafNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(leafHash(i),leafHash(i+vec3(1,0,0)),f.x),mix(leafHash(i+vec3(0,1,0)),leafHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(leafHash(i+vec3(0,0,1)),leafHash(i+vec3(1,0,1)),f.x),mix(leafHash(i+vec3(0,1,1)),leafHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    `+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float leafPaint=leafNoise(vCrownPosition*5.5)*.65+leafNoise(vCrownPosition*13.0)*.35;
      diffuseColor.rgb*=mix(vec3(.78,.85,.72),vec3(1.13,1.12,.99),smoothstep(.2,.78,leafPaint));`)};const mesh=new T.InstancedMesh(geo,crownMat,crowns.length);
  crowns.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(rnd(),rnd()*TAU,rnd()*.3);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,color.set(p.c))});mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
  const texture=new T.TextureLoader().load('./sunny/assets/oak-leaves.png');texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
  const leavesMat=new T.MeshLambertMaterial({color:0xffffff,map:texture,alphaTest:.48,side:T.DoubleSide,emissive:'#728e48',emissiveIntensity:.15});breeze(leavesMat,.11);
  const windHook=leavesMat.onBeforeCompile;leavesMat.onBeforeCompile=shader=>{windHook(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','sampledDiffuseColor.rgb = mix(vec3(1.0),sampledDiffuseColor.rgb,0.38); diffuseColor *= sampledDiffuseColor;'))};
  const leaves=new T.InstancedMesh(new T.PlaneGeometry(1,1),leavesMat,sprigs.length);
  sprigs.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.b,p.a,(rnd()-.5)*1.4);dummy.scale.set(p.s,p.s,1);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,color.set(p.c))});leaves.castShadow=false;leaves.receiveShadow=true;scene.add(leaves);
  return {colliders,count:trees.length};
}
export function addBushes(scene){const g=new T.IcosahedronGeometry(1,1),m=matte('#ffffff'),rows=[];for(let i=0;i<240;i++){let x=(rnd()-.5)*150,z=-100+rnd()*180;if(Math.abs(x-riverX(z))<riverWidth(z)+2||pathDistance(x,z)<2.8||Math.abs(x+19)<6&&Math.abs(z+19)<6)continue;if(noise(x*.1,z*.1)<.05)continue;rows.push({x,z})}let inst=new T.InstancedMesh(g,m,rows.length);rows.forEach((p,i)=>{dummy.position.set(p.x,groundHeight(p.x,p.z)+.38,p.z);dummy.scale.set(.6+rnd()*.7,.5+rnd()*.6,.6+rnd()*.7);dummy.rotation.set(rnd()*.2,rnd()*TAU,0);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,color.set(['#6f9b49','#82ab4b','#91b55c'][i%3]))});inst.castShadow=true;inst.receiveShadow=true;scene.add(inst)}
