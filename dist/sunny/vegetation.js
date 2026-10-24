import * as T from '../vendor/three.module.js';
import {random,noise,groundHeight,riverX,riverWidth,pathDistance,smooth,bareRock} from './terrain.js?v=2';
import {join,makeMesh,breeze} from './plants.js?v=2';
import {barkMaterial,paintedLeafTexture,leafMaterial,groundPaint} from './art-materials.js?v=2';
const TAU=Math.PI*2,rnd=random(9247),dummy=new T.Object3D(),color=new T.Color();
const palette=['#5c9643','#70a44b','#84b454','#9cbe59','#69a04e','#7bad58','#89b657','#659953'];

function branchGeometry(points,baseRadius,tipRadius,steps=12,radial=8){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),frames=curve.computeFrenetFrames(steps,false),positions=[],uv=[],indices=[],length=curve.getLength();
  for(let i=0;i<=steps;i++){let t=i/steps,p=curve.getPointAt(t),r=T.MathUtils.lerp(baseRadius,tipRadius,t)*(1+.07*Math.sin(t*15));for(let j=0;j<=radial;j++){let a=j/radial*TAU,v=p.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);positions.push(v.x,v.y,v.z);uv.push(j/radial,t*length/2.3)}if(i<steps)for(let j=0;j<radial;j++){let n=i*(radial+1)+j;indices.push(n,n+radial+1,n+1,n+1,n+radial+1,n+radial+2)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function canopyGeometry(){const g=new T.IcosahedronGeometry(1,2),p=g.attributes.position,n=g.attributes.normal;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=1+.15*noise(x*6+2,z*5+y*4)+.05*noise(x*13+y*9,z*14);p.setXYZ(i,x*r,y*r,z*r);let l=Math.hypot(x,y,z);n.setXYZ(i,x/l,y/l,z/l)}return g}
export function addArtTrees(scene){
  const oak=barkMaterial(),birch=barkMaterial(true),trees=[],colliders=[],bodies=[],cards=[];
  const fixed=[[-36,23,1.28],[44,22,1.12],[-36,-12,1.04],[-28,-35,1.12],[-9,-42,1.14],[6,-51,1.08],[36,-37,1.15],[49,-12,.96],[-46,-45,1.05],[-54,-4,1.2]];
  fixed.forEach(([x,z,s])=>trees.push({x,z,s}));
  for(let i=0;i<48;i++){let x=(rnd()-.5)*215,z=-64-rnd()*112;if(Math.abs(x-riverX(z))>9)trees.push({x,z,s:.79+rnd()*.6})}
  for(let i=0;i<14;i++)trees.push({x:(rnd()<.5?-1:1)*(55+rnd()*38),z:-27+rnd()*112,s:.8+rnd()*.58});
  for(let i=0;i<trees.length;i++){
    const t=trees[i],h=(i%6===2?10.3:8.4)+rnd()*2.1,birchTree=i%6===2,lean=(rnd()-.5)*1.35,root=new T.Group(),parts=[];root.position.set(t.x,groundHeight(t.x,t.z)-.06,t.z);root.scale.setScalar(t.s);root.rotation.y=rnd()*TAU;scene.add(root);colliders.push({x:t.x,z:t.z,r:t.s*(birchTree?.34:.60)});
    parts.push(branchGeometry([[0,0,0],[lean*.14,1.8,.07],[lean*.5,h*.52,-.22],[lean*.8,h*.79,-.17],[lean,h,.13]],birchTree?.31:.59,.07,17,9));
    for(let k=0;k<5;k++){let a=k*TAU/5+rnd()*.3,r=1.2+rnd()*.6,xx=Math.cos(a)*r,zz=Math.sin(a)*r;parts.push(branchGeometry([[0,.45,0],[xx*.48,.22,zz*.48],[xx,groundHeight(t.x+xx*t.s,t.z+zz*t.s)-root.position.y+.025,zz]],.25,.025,7,7))}
    let terminals=[];
    for(let k=0;k<5;k++){
      let a=k*2.39+rnd()*.7,start=h*(.36+k*.07),r=(birchTree?2.1:3.1)+rnd()*1.1,end=[lean+Math.cos(a)*r,h*(.84+rnd()*.18),Math.sin(a)*r],mid=[end[0]*.57,start+(end[1]-start)*.35,end[2]*.44];
      parts.push(branchGeometry([[lean*.3,start,-.08],mid,end],.23-k*.018,.035,10,7));
      for(let side of [-1,1]){let aa=a+side*.44,ee=[end[0]+Math.cos(aa)*(1+rnd()*.7),end[1]+.50+rnd()*.9,end[2]+Math.sin(aa)*(1+rnd()*.6)];parts.push(branchGeometry([mid,[end[0]*.95,end[1]-.2,end[2]*.95],ee],.075,.008,6,5));terminals.push(ee)}
      terminals.push(end);
    }
    makeMesh(join(parts),birchTree?birch:oak,root);parts.forEach(g=>g.dispose());root.updateMatrixWorld(true);
    for(let j=0;j<terminals.length;j++){
      let c=terminals[j],radius=(birchTree?1.18:1.63)+rnd()*.39,center=new T.Vector3(c[0],c[1]+.25,c[2]);root.localToWorld(center);let sx=radius*t.s,sy=radius*(.68+rnd()*.15)*t.s,sz=radius*(.9+rnd()*.35)*t.s;
      bodies.push({x:center.x,y:center.y,z:center.z,sx:sx*.70,sy:sy*.70,sz:sz*.70,c:palette[(i+j)%palette.length]});
      for(let k=0;k<25;k++){let u=(k+.5)/25,yy=1-u*1.85,a=k*2.39996+rnd()*.35,r=Math.sqrt(1-yy*yy),out=new T.Vector3(Math.cos(a)*r,yy,Math.sin(a)*r);cards.push({x:center.x+out.x*sx*.94,y:center.y+out.y*sy*.95,z:center.z+out.z*sz*.94,s:(1.72+rnd()*.65)*t.s,normal:out,c:palette[(i+j+k)%palette.length],angle:rnd()*TAU})}
    }
  }
  const bodyMat=groundPaint(new T.MeshStandardMaterial({color:0xffffff,roughness:1}));breeze(bodyMat,.013);const body=new T.InstancedMesh(canopyGeometry(),bodyMat,bodies.length);
  bodies.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.sx,p.sy,p.sz);dummy.rotation.set(rnd()*.3,rnd()*TAU,rnd()*.3);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);body.setColorAt(i,color.set(p.c))});body.castShadow=true;body.receiveShadow=true;scene.add(body);
  const leafMat=leafMaterial(paintedLeafTexture());breeze(leafMat,.055);const leaves=new T.InstancedMesh(new T.PlaneGeometry(1,1),leafMat,cards.length),zAxis=new T.Vector3(0,0,1);
  cards.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.quaternion.setFromUnitVectors(zAxis,p.normal);dummy.rotateZ(p.angle);dummy.scale.set(p.s,p.s,.75);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,color.set(p.c))});leaves.receiveShadow=true;leaves.castShadow=false;scene.add(leaves);
  return {colliders,count:trees.length};
}
export function flowerGeometry(petals=7){
  const positions=[],uv=[],colors=[],indices=[];
  for(let p=0;p<petals;p++){let angle=p/petals*TAU,ca=Math.cos(angle),sa=Math.sin(angle),start=positions.length/3;for(let i=0;i<5;i++){let t=i/4,r=.035+t*.21,w=Math.sin(Math.PI*(t*.91+.06))*.079;for(let j=0;j<3;j++){let s=j-1,x=s*w,y=.028*Math.sin(t*Math.PI)-t*t*.033+Math.abs(s)*.012,z=r;positions.push(x*ca-z*sa,y,x*sa+z*ca);uv.push(j/2,t);let v=.76+.24*t;colors.push(v,v*.98,v*.96)}}for(let i=0;i<4;i++)for(let j=0;j<2;j++){let n=start+i*3+j;indices.push(n,n+3,n+1,n+1,n+3,n+4)}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(new Float32Array(positions.length),3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function herbLeaf(length=.23,width=.06){let p=[],uv=[],ix=[];for(let i=0;i<5;i++){let t=i/4,w=Math.sin(Math.PI*t)*width;for(let s of [-1,1]){p.push(s*w,.045*Math.sin(t*Math.PI)+t*.04,t*length);uv.push((s+1)/2,t)}if(i<4){let n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3)}}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g}
export function addArtFlowers(scene){
  const patches=[{x:25,z:-6,r:15,c:0,n:850},{x:36,z:-18,r:13,c:1,n:560},{x:17,z:23,r:10,c:2,n:420},{x:-12,z:-3,r:6,c:2,n:200},{x:-28,z:-11,r:8,c:3,n:340},{x:32,z:9,r:9,c:3,n:370},{x:-19,z:38,r:10,c:1,n:270}],all=[];
  for(let p of patches)for(let i=0;i<p.n*1.4;i++){let a=rnd()*TAU,r=Math.sqrt(rnd())*p.r,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(Math.abs(x-riverX(z))<riverWidth(z)+1||pathDistance(x,z)<1.6||bareRock(x,z,.25)||Math.abs(x+19)<5&&Math.abs(z+19)<5)continue;let field=noise(x*.44,z*.44);if(field<-.25&&rnd()<.85)continue;all.push({x,z,y:groundHeight(x,z),h:.28+rnd()*.48,s:.58+rnd()*.68,type:rnd()<.87?p.c:Math.floor(rnd()*4),a:rnd()*TAU,b:(rnd()-.5)*.42,tone:.85+rnd()*.22})}
  const stemMat=new T.MeshStandardMaterial({color:'#5e883d',roughness:1}),stem=new T.InstancedMesh(new T.CylinderGeometry(.008,.012,1,5),stemMat,all.length);
  all.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.h*.5,p.z);dummy.rotation.set(0,0,p.b*.05);dummy.scale.set(1,p.h,1);dummy.updateMatrix();stem.setMatrixAt(i,dummy.matrix)});stem.receiveShadow=true;scene.add(stem);
  const foliageGeo=join([herbLeaf(.24,.052).rotateY(.6),herbLeaf(.19,.046).rotateY(3.7).translate(0,.13,0)]),foliage=new T.InstancedMesh(foliageGeo,new T.MeshStandardMaterial({color:'#689843',side:T.DoubleSide,roughness:1}),all.length);
  all.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.h*.38,p.z);dummy.rotation.set(-.4,p.a,0);dummy.scale.setScalar(.7+p.s*.4);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix)});foliage.receiveShadow=true;scene.add(foliage);
  const tones=['#e7a2b6','#a99ac8','#fff6d7','#efd47c'];
  for(let type=0;type<4;type++){
    const rows=all.filter(p=>p.type===type),m=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:T.DoubleSide,roughness:.9});breeze(m,.02);const petals=new T.InstancedMesh(flowerGeometry(type===2?9:type===1?5:7),m,rows.length),centers=new T.InstancedMesh(new T.SphereGeometry(.065,9,5,0,TAU,0,Math.PI*.63).scale(1,.53,1),new T.MeshStandardMaterial({color:type===3?'#a98039':'#d9b24c',roughness:1}),rows.length);
    rows.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.h,p.z);dummy.rotation.set(p.b,p.a,(rnd()-.5)*.4);dummy.scale.setScalar(p.s);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);petals.setColorAt(i,color.set(tones[type]).multiplyScalar(p.tone));dummy.position.y+=.017;dummy.updateMatrix();centers.setMatrixAt(i,dummy.matrix)});petals.receiveShadow=true;centers.receiveShadow=true;scene.add(petals,centers);
  }return all.length;
}
export function addGroundLife(scene){
  // Clover mats, ferns, and broad understory leaves add a low layer below flowers.
  const leafParts=[];for(let j=0;j<3;j++){let g=herbLeaf(.23,.095);g.rotateY(j*TAU/3);leafParts.push(g)}let cloverGeo=join(leafParts),cloverMat=new T.MeshStandardMaterial({color:0xffffff,roughness:1,side:T.DoubleSide});breeze(cloverMat,.045);const rows=[];
  for(let i=0;i<3000;i++){let z=-65+rnd()*140,x=(rnd()-.5)*130;if(Math.abs(x-riverX(z))<riverWidth(z)+.8||pathDistance(x,z)<1.55||bareRock(x,z,.25)||Math.abs(x+19)<5&&Math.abs(z+19)<5)continue;if(noise(x*.3,z*.3)<.18)continue;rows.push({x,z})}
  const clover=new T.InstancedMesh(cloverGeo,cloverMat,rows.length);rows.forEach((p,i)=>{dummy.position.set(p.x,groundHeight(p.x,p.z)+.07,p.z);dummy.rotation.set(0,rnd()*TAU,0);dummy.scale.setScalar(.7+rnd()*1.25);dummy.updateMatrix();clover.setMatrixAt(i,dummy.matrix);clover.setColorAt(i,color.set(['#528742','#739c46','#658e40'][i%3]))});clover.receiveShadow=true;scene.add(clover);
  const fronds=[];for(let f=0;f<7;f++){let angle=f/7*TAU;for(let i=1;i<8;i++){let t=i/8,len=.27*Math.sin(t*Math.PI),y=Math.sin(t*Math.PI*.75)*.65,r=t*.62;for(let side of [-1,1]){let g=herbLeaf(len,.045*Math.sin(t*Math.PI));g.rotateY(side*1.05);g.rotateX(-.25);g.translate(0,y,r);g.rotateY(angle);fronds.push(g)}}}const fernMat=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.96});breeze(fernMat,.025);const fernRows=[];
  for(let i=0;i<390;i++){let z=-85+rnd()*160,x=riverX(z)+(i%2?1:-1)*(riverWidth(z)+1.7+rnd()*6);if(pathDistance(x,z)<2.5||bareRock(x,z,.8)||Math.abs(x+19)<5&&Math.abs(z+19)<5)continue;fernRows.push({x,z})}
  const fern=new T.InstancedMesh(join(fronds),fernMat,fernRows.length);fernRows.forEach((p,i)=>{dummy.position.set(p.x,groundHeight(p.x,p.z),p.z);dummy.rotation.set(0,rnd()*TAU,0);dummy.scale.setScalar(.6+rnd()*.75);dummy.updateMatrix();fern.setMatrixAt(i,dummy.matrix);fern.setColorAt(i,color.set(i%2?'#668f48':'#79a155'))});fern.receiveShadow=true;scene.add(fern);
  const shrubRows=[],normalZ=new T.Vector3(0,0,1);for(let i=0;i<95;i++){let z=-78+rnd()*155,side=i%2?1:-1,x=riverX(z)+side*(riverWidth(z)+2.3+rnd()*5.2);if(pathDistance(x,z)<2.8||bareRock(x,z,1.0)||Math.abs(x+19)<5&&Math.abs(z+19)<5)continue;let y=groundHeight(x,z),size=.55+rnd()*.55;for(let k=0;k<19;k++){let a=k*2.4,up=.15+rnd()*.8,r=Math.sqrt(1-up*up),out=new T.Vector3(Math.cos(a)*r,up,Math.sin(a)*r);shrubRows.push({x:x+out.x*size*.57,y:y+size*.32+out.y*size*.6,z:z+out.z*size*.57,s:size,normal:out})}}
  const shrubMat=leafMaterial(paintedLeafTexture());breeze(shrubMat,.028);const shrubs=new T.InstancedMesh(new T.PlaneGeometry(1,1),shrubMat,shrubRows.length);shrubRows.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.quaternion.setFromUnitVectors(normalZ,p.normal);dummy.rotateZ(i*1.7);dummy.scale.setScalar(p.s);dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);shrubs.setColorAt(i,color.set(i%3===0?'#7ea453':'#61934b'))});shrubs.receiveShadow=true;scene.add(shrubs);
  // A few fallen petals collect at the cottage path instead of covering every surface.
  const petalsGeo=new T.SphereGeometry(1,6,3).scale(.055,.009,.09),petals=new T.InstancedMesh(petalsGeo,new T.MeshLambertMaterial({color:0xffffff}),110);
  for(let i=0;i<110;i++){let a=rnd()*TAU,r=Math.sqrt(rnd())*8,x=-20+Math.cos(a)*r,z=-9+Math.sin(a)*r;dummy.position.set(x,groundHeight(x,z)+.035,z);dummy.rotation.set(0,rnd()*TAU,rnd()*.2);dummy.scale.setScalar(.7+rnd()*.9);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);petals.setColorAt(i,color.set(i%3?'#edc0b6':'#d7c690'))}petals.receiveShadow=true;scene.add(petals);
}
