import * as T from '../vendor/three.module.js';
import {groundHeight,riverX,riverWidth,waterY,random,noise,mix,smooth,pathPoints,cottage,bridge} from './terrain.js';
import {matte,makeMesh,beam,windTime,addTrees,addGrass,addFlowers,addBushes} from './plants.js';
const rnd=random(678),TAU=Math.PI*2,color=new T.Color(),dummy=new T.Object3D();
const cube=(p,m,x,y,z,a,b,c)=>makeMesh(new T.BoxGeometry(a,b,c),m,p,x,y,z);
const sphere=(p,m,x,y,z,a,b,c)=>{let o=makeMesh(new T.SphereGeometry(1,12,8),m,p,x,y,z);o.scale.set(a,b,c);return o};
function ribbon(points,width,yFn){let pos=[],uv=[],ix=[];for(let i=0;i<points.length;i++){let p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)],dx=next[0]-prev[0],dz=next[1]-prev[1],l=Math.hypot(dx,dz)||1;for(let k=0;k<2;k++){let s=(k-.5)*width,x=p[0]+dz/l*s,z=p[1]-dx/l*s;pos.push(x,yFn(x,z),z);uv.push(k,i/(points.length-1));}if(i<points.length-1){let n=i*2;ix.push(n,n+2,n+1,n+1,n+2,n+3)}}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g}
function addTerrain(scene){
  let g=new T.PlaneGeometry(440,460,280,300);g.rotateX(-Math.PI/2);g.translate(0,0,-70);let p=g.attributes.position,colors=[],a=new T.Color('#92bf59'),b=new T.Color('#77a94e'),sand=new T.Color('#b8c78d');
  for(let i=0;i<p.count;i++){let x=p.getX(i),z=p.getZ(i),h=groundHeight(x,z);p.setY(i,h);let variation=.5+.28*noise(x*.15,z*.15)+.17*noise(x*.72,z*.72);color.copy(a).lerp(b,variation);let bank=1-smooth(riverWidth(z)+.8,riverWidth(z)+3,Math.abs(x-riverX(z)));color.lerp(sand,bank*.72);if(z<-115)color.lerp(new T.Color('#7caa74'),smooth(-115,-200,z)*.2);colors.push(color.r,color.g,color.b)}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();let m=new T.MeshLambertMaterial({vertexColors:true});let mesh=makeMesh(g,m,scene);mesh.castShadow=false;mesh.receiveShadow=true;
  const pathMat=new T.MeshLambertMaterial({color:'#d6c294',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  pathMat.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 vTrailUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTrailUv=uv;');shader.fragmentShader='varying vec2 vTrailUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float edge = smoothstep(0.0,.23,vTrailUv.x)*(1.0-smoothstep(.77,1.0,vTrailUv.x));
    float grain = sin(vTrailUv.y*1417.0+sin(vTrailUv.x*53.0))*sin(vTrailUv.x*73.0+vTrailUv.y*701.0);
    diffuseColor.rgb *= 1.0+grain*.035;
    diffuseColor.a *= edge*.9;`)};
  const main=pathPoints.slice(0,121),branch=pathPoints.slice(121);for(const points of [main,branch]){let path=makeMesh(ribbon(points,4.4,(x,z)=>groundHeight(x,z)+.035),pathMat,scene);path.receiveShadow=true;path.castShadow=false}
}
function addWater(scene){
  const pos=[],uv=[],ix=[],steps=330,wide=12;
  for(let i=0;i<=steps;i++){let z=mix(-235,150,i/steps),w=riverWidth(z);for(let j=0;j<=wide;j++){let u=j/wide,x=riverX(z)+(u-.5)*w*2;pos.push(x,waterY(z),z);uv.push(u,i/steps)}if(i<steps)for(let j=0;j<wide;j++){let n=i*(wide+1)+j;ix.push(n,n+wide+1,n+1,n+1,n+wide+1,n+wide+2)}}
  let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();
  let m=new T.MeshStandardMaterial({color:0xffffff,roughness:.25,metalness:.08,transparent:true,opacity:.94});m.onBeforeCompile=shader=>{shader.uniforms.uFlowTime=windTime;shader.vertexShader='uniform float uFlowTime; varying vec3 vFlowPosition; varying vec2 vFlowUv;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vFlowPosition=position;vFlowUv=uv;
    transformed.y += sin(position.z*1.9+position.x*.8-uFlowTime*1.6)*.023+sin(position.x*2.2+uFlowTime)*.015;`);shader.fragmentShader='uniform float uFlowTime; varying vec3 vFlowPosition; varying vec2 vFlowUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 p=vFlowPosition.xz;
    float edges=abs(vFlowUv.x*2.0-1.0);
    float ripple=sin(p.y*2.4+sin(p.x*1.9)*1.6-uFlowTime*1.7);
    float sparkle=pow(max(0.0,ripple),22.0)*smoothstep(.15,.8,sin(p.x*4.0+p.y*.8+uFlowTime*.6));
    float glint=pow(max(0.0,sin(p.x*9.0-p.y*3.1+uFlowTime*1.5)),42.0)*pow(max(0.0,sin(p.y*5.0+uFlowTime)),12.0);
    float edgeFoam=smoothstep(.84,.995,edges+.018*sin(p.y*6.0-uFlowTime*2.0));
    vec3 clearWater=mix(vec3(.12,.55,.54),vec3(.43,.79,.72),smoothstep(.15,.92,edges));
    clearWater += sin(p.y*.57+p.x*.9-uFlowTime*.3)*.018;
    diffuseColor.rgb=mix(clearWater,vec3(.9,.98,.87),clamp(sparkle*.45+glint*.6+edgeFoam*.85,0.0,1.0));
    diffuseColor.a=.94;`)};let water=makeMesh(g,m,scene);water.castShadow=false;water.receiveShadow=true;
  const rockMat=matte('#b0b7a0'),rockGeo=new T.DodecahedronGeometry(1,1),stones=new T.InstancedMesh(rockGeo,rockMat,230);
  for(let i=0;i<230;i++){let z=-125+rnd()*235,side=i%2?1:-1,x=riverX(z)+side*(riverWidth(z)+.05+rnd()*1.6),s=.2+rnd()*.65;dummy.position.set(x,groundHeight(x,z)+s*.1,z);dummy.rotation.set(rnd(),rnd()*TAU,rnd()*.3);dummy.scale.set(s*1.4,s*.65,s);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix)}stones.receiveShadow=true;stones.castShadow=true;scene.add(stones);
  // Low gravel bars are visible through the shallow, lightly tinted edges.
  for(let i=0;i<25;i++){let z=-30+rnd()*80,x=riverX(z)+(rnd()-.5)*riverWidth(z)*1.6,s=.2+rnd()*.38,o=makeMesh(rockGeo,matte(i%2?'#b7b995':'#a6ac97'),scene,x,waterY(z)-.12,z);o.scale.set(s*1.8,s*.45,s);o.rotation.y=rnd()*TAU;}
}
function addBridge(scene){
  const wood=matte('#ae8251'),rail=matte('#91734a'),dark=matte('#7c6648'),g=new T.Group();g.position.set(bridge.x,bridge.y,bridge.z);scene.add(g);
  const arch=x=>.52*(1-(x/6.6)**2);
  for(let i=0;i<28;i++){let x=-6.6+i*.49,board=cube(g,wood,x,arch(x),0,.47,.18,3.18);board.rotation.z=-x*.023;if(i%4===0)for(const z of [-1.4,1.4])cube(g,dark,x,arch(x)+.1,z,.045,.02,.045)}
  for(const z of [-1.65,1.65]){for(let i=0;i<7;i++){let x=-6.1+i*2.03,h=arch(x);cube(g,rail,x,h+.74,z,.16,1.55,.16);sphere(g,wood,x,h+1.57,z,.15,.11,.15);if(i<6){let xx=x+2.03;beam(g,[x,h+1.35,z],[xx,arch(xx)+1.35,z],.075,.075,rail,6);beam(g,[x,h+.58,z],[xx,arch(xx)+.58,z],.043,.043,rail,5)}}}
  for(const x of [-4.7,4.7])for(const z of [-1.1,1.1])cube(g,dark,x,-.7,z,.25,1.8,.25);
}
function addCottage(scene){
  const root=new T.Group();root.position.set(cottage.x,cottage.y,cottage.z);root.rotation.y=-.09;scene.add(root);
  const plaster=new T.MeshStandardMaterial({color:'#f1e5c4',roughness:1}),timber=matte('#80664b'),timberLight=matte('#b29a6d'),roofMat=matte('#b56b53'),stone=matte('#ada58c'),glass=new T.MeshStandardMaterial({color:'#7baead',roughness:.23,metalness:.1}),shutter=matte('#72948a'),ivory=matte('#fbefce');
  cube(root,stone,0,.33,0,8.2,.65,7.6);cube(root,plaster,0,2.55,0,7.6,4.45,7);
  for(let k=0;k<40;k++){let front=k<20,x=-3.8+(k%10)*.84,z=front?3.59:-3.59,y=(k%20<10?.22:.57);let o=cube(root,matte(k%3===0?'#b9b49d':'#aaa58e'),x,y,z,.78,.31,.21);o.rotation.z=(rnd()-.5)*.07}
  // Solid plaster gables with individually laid terracotta shingles.
  const shape=new T.Shape();shape.moveTo(-3.8,4.7);shape.lineTo(0,7.65);shape.lineTo(3.8,4.7);shape.closePath();const frontGable=makeMesh(new T.ShapeGeometry(shape),plaster,root,0,0,3.51);makeMesh(new T.ShapeGeometry(shape),plaster,root,0,0,-3.51).rotation.y=Math.PI;
  const roofPositions=[-4.65,4.55,-4.2,0,8.05,-4.2,4.65,4.55,-4.2,-4.65,4.55,4.2,0,8.05,4.2,4.65,4.55,4.2];let rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(roofPositions,3));rg.setIndex([0,3,1,1,3,4,1,4,2,2,4,5]);rg.computeVertexNormals();let roof=makeMesh(rg,new T.MeshLambertMaterial({color:'#b76b54',side:T.DoubleSide}),root);
  let tiles=new T.InstancedMesh(new T.BoxGeometry(.69,.105,.58),matte('#ffffff'),2*9*15),n=0;
  for(const side of [-1,1])for(let row=0;row<9;row++)for(let col=0;col<15;col++){let x=side*(.26+row*.53),y=8.05-Math.abs(x)*.752+.035,z=-4.02+col*.575;dummy.position.set(x,y,z);dummy.rotation.set(0,0,-side*.645);dummy.scale.set(1,1,1);dummy.updateMatrix();tiles.setMatrixAt(n,dummy.matrix);tiles.setColorAt(n,color.set(['#bb735c','#c87f64','#b96e55','#cf8a6d','#bd765e'][Math.floor(rnd()*5)]));n++}tiles.castShadow=true;tiles.receiveShadow=true;root.add(tiles);
  for(const z of [-4.26,4.26]){beam(root,[-4.7,4.55,z],[0,8.12,z],.12,.12,timber,5);beam(root,[0,8.12,z],[4.7,4.55,z],.12,.12,timber,5)}
  cube(root,timber,0,4.73,3.6,7.8,.18,.16);cube(root,timber,0,5.87,3.60,.15,2.25,.16);cube(root,timber,0,4.73,-3.6,7.8,.18,.16);
  for(const x of [-3.79,3.79])for(const z of [-3.49,3.49])cube(root,timber,x,2.7,z,.18,4.2,.17);
  for(const x of [-3.8,3.8]){cube(root,timber,x,2.7,0,.13,.13,7.1);beam(root,[x,.65,-2.9],[x,2.7,-.5],.075,.075,timber,4);beam(root,[x,2.7,.6],[x,4.68,3.2],.075,.075,timber,4)}
  const doorShape=new T.Shape();doorShape.moveTo(-.77,0);doorShape.lineTo(-.77,2.15);doorShape.absarc(0,2.15,.77,Math.PI,0,true);doorShape.lineTo(.77,0);doorShape.closePath();let door=makeMesh(new T.ExtrudeGeometry(doorShape,{depth:.12,bevelEnabled:false}),timber,root,0,.65,3.53);cube(root,shutter,0,1.79,3.68,1.27,2.16,.08);for(let i=0;i<6;i++)cube(root,timberLight,-.54+i*.216,1.78,3.735,.024,2.1,.025);sphere(root,matte('#cba75f'),.39,1.73,3.82,.07,.07,.065);
  function window(x,y,z,side=false){let w=new T.Group();w.position.set(x,y,z);if(side)w.rotation.y=Math.PI/2;root.add(w);cube(w,timber,0,0,0,1.53,1.73,.17);cube(w,glass,0,0,.1,1.26,1.46,.06);cube(w,ivory,0,0,.155,.065,1.52,.045);cube(w,ivory,0,0,.16,1.28,.065,.05);cube(w,ivory,0,-.86,.12,1.7,.13,.35);for(const side of [-1,1]){let panel=cube(w,shutter,side*1.09,0,.12,.50,1.65,.10);panel.rotation.y=side*.2;for(let k=0;k<7;k++)cube(w,timberLight,side*1.09,-.66+k*.22,.2,.44,.025,.04)}
    const box=cube(w,timberLight,0,-1.12,.38,1.65,.32,.50);cube(w,matte('#4e713d'),0,-.95,.38,1.5,.10,.41);for(let i=0;i<10;i++){let xx=(rnd()-.5)*1.35,yy=-.76+rnd()*.2,zz=.35+rnd()*.22;sphere(w,matte(i%3?'#dc9a9e':'#fff1ad'),xx,yy,zz,.12,.1,.12);sphere(w,matte('#6d984f'),xx,-.85,zz,.13,.16,.11)}}
  window(-2.16,2.65,3.56);window(2.16,2.65,3.56);window(3.84,2.6,-1.1,true);
  let circle=makeMesh(new T.CircleGeometry(.50,24),glass,root,0,5.73,3.63);makeMesh(new T.TorusGeometry(.55,.08,6,24),timber,root,0,5.73,3.64);cube(root,ivory,0,5.73,3.68,.055,1,.05);cube(root,ivory,0,5.73,3.68,1,.055,.05);
  // A little covered porch and shallow steps make the entrance feel inhabited.
  for(const x of [-1.31,1.31])cube(root,timber,x,1.9,5.15,.12,2.6,.12);
  cube(root,timberLight,0,.56,4.51,3.1,.17,2.1);for(let i=0;i<3;i++)cube(root,stone,0,.4-i*.13,5.65+i*.28,2.30,.14,.35);
  let awning=cube(root,roofMat,0,3.40,4.63,3.25,.16,2.37);awning.rotation.x=.15;cube(root,timber,0,3.13,5.28,3.2,.14,.16);
  // Masonry chimney, cap, and a gently rising thread of smoke.
  for(let row=0;row<8;row++)for(let col=0;col<3;col++){let x=2.32+(col-1)*.34,y=6.55+row*.30;cube(root,matte((row+col)%3?'#b9b5a2':'#a19e8a'),x,y,-1.9,.32,.28,.89)}cube(root,timber,2.32,9.0,-1.9,1.24,.20,1.16);
  const smoke=[];let canvas=document.createElement('canvas');canvas.width=canvas.height=64;let ctx=canvas.getContext('2d'),grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,242,.48)');grad.addColorStop(1,'rgba(255,255,242,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);let smokeTexture=new T.CanvasTexture(canvas);
  for(let i=0;i<8;i++){let m=new T.SpriteMaterial({map:smokeTexture,transparent:true,depthWrite:false,opacity:.40}),s=new T.Sprite(m);root.add(s);smoke.push(s)}
  // Ivy catches the corner of the wall; lavender pots flank the door.
  for(let i=0;i<24;i++){let y=.8+i*.15,x=-3.55+Math.sin(i*.7)*.24;sphere(root,matte(i%2?'#7e9c50':'#8baa57'),x,y,3.66,.20,.12,.065);if(i%3===0)sphere(root,matte('#d1a3ad'),x+.1,y+.1,3.70,.10,.10,.05)}
  for(const x of [-1.72,1.74]){makeMesh(new T.CylinderGeometry(.35,.23,.62,10),matte('#b77e62'),root,x,.88,4.35);for(let i=0;i<7;i++){let a=rnd()*TAU,xx=x+Math.cos(a)*.23,z=4.35+Math.sin(a)*.22,h=.5+rnd()*.35;beam(root,[xx,1.14,z],[xx,1.14+h,z],.016,.01,matte('#6e9152'),4);sphere(root,matte('#b8a3d3'),xx,1.14+h,z,.075,.17,.075)}}
  return {smoke,root};
}
function addFenceAndBench(scene){
  const wood=matte('#b7a274'),dark=matte('#95845d');
  const fence=[[-37,-4],[-34,-2],[-31,0],[-28,2]];
  fence.forEach((p,i)=>{let y=groundHeight(...p);cube(scene,wood,p[0],y+.65,p[1],.18,1.4,.18);if(i<fence.length-1){let q=fence[i+1],yy=groundHeight(...q);for(let h of [.52,1.05])beam(scene,[p[0],y+h,p[1]],[q[0],yy+h,q[1]],.055,.055,wood,4)}});
  const root=new T.Group(),x=37,z=11;root.position.set(x,groundHeight(x,z),z);root.rotation.y=-.45;scene.add(root);
  for(let zz of [-.27,0,.27])cube(root,wood,0,.65,zz,2.65,.12,.23);for(let x of [-1.0,1.0]){cube(root,dark,x,.32,0,.13,.65,.63);cube(root,dark,x,1.05,-.43,.12,1.15,.12)}for(let yy of [1.05,1.33])cube(root,wood,0,yy,-.43,2.65,.19,.10);
}
function addBackdrop(scene){
  const ridgeColors=['#9fc5ad','#aaccc0','#bfd9cf'];
  for(let layer=2;layer>=0;layer--){let positions=[],indices=[],n=120,z=-220-layer*85;for(let i=0;i<=n;i++){let x=-600+i*1200/n,peaks=40+Math.sin(x*.011+layer*1.7)*20+Math.sin(x*.029+.7)*9+noise(x*.03,layer*7)*5+layer*11;positions.push(x,-15,z,x,peaks,z);if(i<n){let k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();let m=new T.MeshBasicMaterial({color:ridgeColors[layer],side:T.DoubleSide,fog:true});makeMesh(g,m,scene).castShadow=false}
  const cloudMat=new T.MeshLambertMaterial({color:'#fffbe8',emissive:'#dddcc8',emissiveIntensity:.16}),clouds=[];
  for(let i=0;i<14;i++){let g=new T.Group();g.position.set(-260+rnd()*520,72+rnd()*45,-160-rnd()*230);let size=7+rnd()*12;for(let j=0;j<7;j++){let a=j/7*TAU,o=sphere(g,cloudMat,Math.cos(a)*size*.85,Math.sin(a*1.7)*size*.14,Math.sin(a)*size*.24,size*(.6+rnd()*.4),size*(.28+rnd()*.25),size*.43);o.castShadow=false;o.receiveShadow=false}scene.add(g);clouds.push(g)}return clouds;
}
function addButterflies(scene){const butterflies=[];for(let i=0;i<17;i++){let g=new T.Group(),mat=new T.MeshBasicMaterial({color:i%3===0?'#fff0a4':i%3===1?'#f3b6b0':'#f7f3da',side:T.DoubleSide});let wings=[];for(let side of [-1,1]){let shape=new T.Shape();shape.moveTo(0,0);shape.bezierCurveTo(.20*side,.30,.4*side,.22,.30*side,-.02);shape.bezierCurveTo(.35*side,-.26,.12*side,-.20,0,0);let wing=makeMesh(new T.ShapeGeometry(shape),mat,g);wing.rotation.x=-Math.PI*.2;wings.push(wing)}scene.add(g);butterflies.push({group:g,wings,phase:rnd()*TAU,x:18+rnd()*22,z:-10+rnd()*40})}return butterflies}
export function createValley(scene,{lightweight=false}={}){
  addTerrain(scene);addWater(scene);addBridge(scene);const home=addCottage(scene);addFenceAndBench(scene);const clouds=addBackdrop(scene);const trees=addTrees(scene);addBushes(scene);const grass=addGrass(scene,lightweight),flowerCount=addFlowers(scene),butterflies=addButterflies(scene);
  return {grass,trees,flowerCount,update(t,wind=true){windTime.value=wind?t:0;clouds.forEach((g,i)=>g.position.x+=Math.sin(i+1)*.0016);home.smoke.forEach((s,i)=>{let phase=(t*.14+i/8)%1;s.position.set(2.32+phase*2,9.13+phase*5,-1.9+Math.sin(phase*5)*.24);s.scale.setScalar(.7+phase*2.8);s.material.opacity=(1-phase)*.33});butterflies.forEach((b,i)=>{let a=t*.28+b.phase;b.group.position.set(b.x+Math.cos(a)*2.8,groundHeight(b.x,b.z)+1.5+Math.sin(a*1.8)*.65,b.z+Math.sin(a*.8)*2.2);b.group.rotation.y=-a;b.wings[0].rotation.y=Math.sin(t*9+i)*.8;b.wings[1].rotation.y=-Math.sin(t*9+i)*.8})}};
}
