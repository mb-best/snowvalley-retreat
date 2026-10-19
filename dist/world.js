import * as T from './vendor/three.module.js';
import {rng,noise,fbm,elevation,configureTerrain,lake,lakeDistance,streamX,smooth,clamp,mix,species} from './math.js';
const TAU=Math.PI*2;const rand=rng(2391), temp=new T.Object3D();
const v3=(x,y,z)=>new T.Vector3(x,y,z);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.94,...extra});
function mesh(g,m,parent,x=0,y=0,z=0){let o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function box(p,m,x,y,z,a,b,c){return mesh(new T.BoxGeometry(a,b,c),m,p,x,y,z)}
function ellipsoid(p,m,x,y,z,a,b,c){let o=mesh(new T.SphereGeometry(1,20,14),m,p,x,y,z);o.scale.set(a,b,c);return o}
function cylinder(p,m,a,b,r1,r2=r1,segments=8){let d=new T.Vector3().subVectors(b,a),o=mesh(new T.CylinderGeometry(r2,r1,d.length(),segments),m,p);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(v3(0,1,0),d.normalize());return o}
function texturedCanvas(kind){let c=document.createElement('canvas');c.width=c.height=256;let ctx=c.getContext('2d'),im=ctx.createImageData(256,256);for(let z=0;z<256;z++)for(let x=0;x<256;x++){let n=rand(),v;if(kind==='stone'){let seam=(z%31<2)||((x+(Math.floor(z/31)%2)*30)%64<2);v=seam?70:155+n*65}else if(kind==='wood'){v=110+30*Math.sin(x*.35+noise(x*.03,z*.02)*10)+n*35}else v=160+n*65;let i=(z*256+x)*4;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=255}ctx.putImageData(im,0,0);let t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='ground'?360:3,kind==='ground'?360:3);t.colorSpace=T.SRGBColorSpace;return t}
const noiseGLSL=`float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float nse(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+1.),f.x),f.y);}`+"\n";
export class World{
 constructor(scene,low=false){this.scene=scene;this.low=low;this.animals=[];this.plants=[];this.windows=[];this.smoke=[];this.water=[];this.seasonal=[];this.colliders=[];this.weather='clear';this.season=0;this.time=0;this.uniforms={uSeason:{value:0},uWinter:{value:0},uTime:{value:0},uGround:{value:new T.Color('#79875a')},uNeedle:{value:new T.Color('#324e3e')}};this.mats={wood:mat('#70553e',{map:texturedCanvas('fur')}),darkwood:mat('#483e32'),stone:mat('#a1a095',{map:texturedCanvas('stone')}),plaster:mat('#c3ba9e'),roof:mat('#544d44'),window:mat('#b29357',{emissive:'#ffb15d',emissiveIntensity:0}),fence:mat('#89765a'),rock:mat('#79817a'),snow:mat('#e7edeb')};}
 async build(progress){
  configureTerrain(this.low?240:370);
  this.makeTerrain();await progress(18,'山川已经铺开，正在种下松林…');
  this.makeTrees();this.makeRocks();await progress(42,'草甸与野花正在醒来…');
  this.makeGrass();this.makePlants();this.makeWater();await progress(66,'为村庄点起第一盏灯…');
  this.makeVillage();this.makeAnimals();this.makeSky();await progress(91,'让风和四季走进山谷…');
 }
 makeTerrain(){
  const geo=new T.PlaneGeometry(2500,2500,this.low?240:370,this.low?240:370);geo.rotateX(-Math.PI/2);let a=geo.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,elevation(a.getX(i),a.getZ(i)));geo.computeVertexNormals();
  let material=mat('#ffffff',{map:texturedCanvas('ground')});material.onBeforeCompile=s=>{Object.assign(s.uniforms,this.uniforms);s.vertexShader='varying vec3 vTP;varying vec3 vTN;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvTP=(modelMatrix*vec4(transformed,1.)).xyz;vTN=normalize(mat3(modelMatrix)*objectNormal);');s.fragmentShader='varying vec3 vTP; varying vec3 vTN;uniform float uWinter; uniform vec3 uGround;\n'+noiseGLSL+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float grain=nse(vTP.xz*.07);float slope=1.-normalize(vTN).y;
   float rock=smoothstep(.17,.53,slope)+smoothstep(90.,210.,vTP.y)*.45;
   vec3 grass=uGround*(.8+grain*.35);float strata=nse(vec2(vTP.x*.19+vTP.z*.07,vTP.y*.23));float detail=nse(vTP.xz*.35+vTP.y*.12);vec3 rockColor=mix(vec3(.25,.28,.27),vec3(.53,.55,.53),grain*.55+strata*.3+detail*.15);
   vec3 ground=mix(grass,rockColor,clamp(rock,0.,1.));
   float p1=abs(vTP.x-(-53.+sin(vTP.z*.025)*10.));float p2=abs(vTP.z-48.+sin(vTP.x*.03)*3.);
   float path=(1.-smoothstep(1.7,3.8,min(p1,p2)))*(1.-smoothstep(90.,145.,length(vTP.xz-vec2(-30.,30.))));
   ground=mix(ground,vec3(.48,.43,.32),path*.8);
   float snowline=mix(175.,9.,uWinter);float snow=smoothstep(snowline-15.,snowline+22.,vTP.y+grain*32.)*smoothstep(.12,.6,normalize(vTN).y);
   ground=mix(ground,vec3(.91,.95,.96),snow);
   diffuseColor.rgb*=ground;`)};
  this.ground=mesh(geo,material,this.scene);this.ground.castShadow=false;
 }
 makeTrees(){
  const positions=[];let max=this.low?600:1100;for(let i=0;i<10000&&positions.length<max;i++){let x=(rand()-.5)*1150,z=rand()*1150-570,h=elevation(x,z),l=lakeDistance(x,z),forest=noise(x*.009+20,z*.009);let village=Math.hypot(x+55,z-25)<95;
   if(h>175||h<9.8||l<1.16||village||Math.abs(x-streamX(z))<13||forest<.38||(z>0&&Math.abs(x)<160&&rand()<.94))continue;
   positions.push([x,h,z,.8+rand()*1.25,rand()*6.28]);}
  // Deliberate framing trees around the shore, village, and trail.
  for(const [x,z] of [[-138,12],[-145,27],[-120,-20],[-105,-45],[11,-110],[-10,-130],[200,12],[230,-75],[-180,86],[-175,120],[-230,-120],[-215,-145],[-235,-155]])positions.push([x,elevation(x,z),z,1.1+rand()*.3,rand()*6.28]);
  const verts=[],inds=[];let height=12;for(let tier=0;tier<8;tier++){let y=1.4+tier*1.1,r=(1-tier/9)*3.2;let start=verts.length/3;let count=19;for(let j=0;j<count;j++){let a=j/count*Math.PI*2,rr=r*(.63+rand()*.65);verts.push(Math.cos(a)*rr,y+(rand()-.5)*.65,Math.sin(a)*rr)}verts.push(.1*(rand()-.5),y+3.6,0);for(let j=0;j<count;j++)inds.push(start+j,start+(j+1)%count,start+count)}let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();let needles=mat('#ffffff',{side:T.DoubleSide});needles.onBeforeCompile=s=>{Object.assign(s.uniforms,this.uniforms);s.vertexShader='varying vec3 vLeaf; uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vLeaf=position; transformed.x+=sin(uTime*.65+position.y+instanceMatrix[3].x*.03)*.08*max(position.y-2.,0.)/8.;`);s.fragmentShader='uniform vec3 uNeedle; uniform float uWinter; varying vec3 vLeaf;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 foliage=uNeedle*(.8+.25*sin(vLeaf.y*3.));float dust=smoothstep(6.,11.,vLeaf.y)*uWinter;diffuseColor.rgb*=mix(foliage,vec3(.85,.91,.9),dust*.8);`)};
  let trees=new T.InstancedMesh(geo,needles,positions.length),trunks=new T.InstancedMesh(new T.CylinderGeometry(.17,.32,6,6),this.mats.wood,positions.length);trees.castShadow=true;trees.receiveShadow=true;trunks.castShadow=true;trunks.receiveShadow=true;
  positions.forEach(([x,y,z,s,r],i)=>{temp.position.set(x,y,z);temp.scale.set(s,s*(.85+rand()*.3),s);temp.rotation.set(0,r,0);temp.updateMatrix();trees.setMatrixAt(i,temp.matrix);temp.position.y=y+3*s;temp.scale.set(s,s,s);temp.updateMatrix();trunks.setMatrixAt(i,temp.matrix);this.colliders.push({x,z,r:.5*s})});this.scene.add(trees,trunks);this.trees=trees;this.trunks=trunks;
  this.makeBirches();
 }
 makeBirches(){
  let group=new T.Group(),leafData=[],c=document.createElement('canvas');c.width=c.height=64;let ctx=c.getContext('2d');ctx.fillStyle='#eff2d9';ctx.beginPath();ctx.moveTo(32,3);ctx.bezierCurveTo(10,10,2,40,32,60);ctx.bezierCurveTo(62,40,54,10,32,3);ctx.fill();ctx.strokeStyle='#8b9a68';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(32,7);ctx.lineTo(32,58);for(let j=0;j<5;j++){let y=18+j*7;ctx.moveTo(32,y+6);ctx.lineTo(13+j*2,y-2);ctx.moveTo(32,y+6);ctx.lineTo(51-j*2,y-2)}ctx.stroke();let tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;let leaves=mat('#9aaf65',{map:tx,alphaTest:.45,side:T.DoubleSide,roughness:.9});this.birchMat=leaves;let bark=mat('#b5b9a6',{map:texturedCanvas('fur')});
  for(let i=0;i<26;i++){let x=-135+rand()*90,z=-25+rand()*170;if(lakeDistance(x,z)<1.2)continue;let y=elevation(x,z),g=new T.Group();g.position.set(x,y,z);cylinder(g,bark,v3(0,0,0),v3(.4,7,0),.12,.045,8);
   for(let j=0;j<9;j++){let a=j*2.4,px=Math.cos(a)*(1+rand()*1.4),pz=Math.sin(a)*(1+rand()*1.4),py=5.4+j*.29;cylinder(g,bark,v3(.15,2.9+j*.4,0),v3(px,py,pz),.05,.012,6);
    for(let k=0;k<55;k++){let r=Math.cbrt(rand()),az=rand()*TAU,el=rand()*2-1,s=Math.sqrt(1-el*el);leafData.push([x+px+r*s*Math.cos(az)*1.35,y+py+r*el*1.2,z+pz+r*s*Math.sin(az)*1.35,rand()])}
   }group.add(g)
  }
  let leafMesh=new T.InstancedMesh(new T.PlaneGeometry(.65,.38),leaves,leafData.length);leafMesh.castShadow=true;leafMesh.receiveShadow=true;leafData.forEach(([x,y,z,r],i)=>{temp.position.set(x,y,z);temp.rotation.set(rand()*Math.PI,rand()*TAU,rand()*TAU);let s=.65+rand()*.8;temp.scale.set(s,s,s);temp.updateMatrix();leafMesh.setMatrixAt(i,temp.matrix);leafMesh.setColorAt(i,new T.Color().setScalar(.65+rand()*.45))});group.add(leafMesh);this.scene.add(group);this.birches=group;
 }
 makeRocks(){let n=this.low?190:360,geo=new T.IcosahedronGeometry(1,1),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){let k=.8+hash3(pos.getX(i),pos.getY(i),pos.getZ(i))*.3;pos.setXYZ(i,pos.getX(i)*k,pos.getY(i)*k,pos.getZ(i)*k)}geo.computeVertexNormals();let rocks=new T.InstancedMesh(geo,this.mats.rock,n);rocks.castShadow=true;rocks.receiveShadow=true;for(let i=0;i<n;i++){let a=rand()*6.28,x,z;if(i<n*.5){let d=1.05+rand()*.18;x=lake.x+Math.cos(a)*lake.rx*d;z=lake.z+Math.sin(a)*lake.rz*d}else{x=(rand()-.5)*650;z=rand()*750-500}let s=.5+rand()*2.8;temp.position.set(x,elevation(x,z),z);temp.scale.set(s, s*(.4+rand()*.55),s*(.7+rand()*.5));temp.rotation.set(rand(),rand()*6.28,rand());temp.updateMatrix();rocks.setMatrixAt(i,temp.matrix)}this.scene.add(rocks)}
 makeGrass(){
  const positions=[],n=this.low?12000:28000;for(let i=0;i<n*3&&positions.length<n;i++){let x=(rand()-.5)*620,z=rand()*650-260,h=elevation(x,z);if(h>120||h<10||lakeDistance(x,z)<1.08||Math.hypot(x+58,z-30)<33||Math.abs(x+53-Math.sin(z*.025)*10)<3||Math.abs(z-48+Math.sin(x*.03)*3)<2.8)continue;positions.push([x,h,z])}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.09,0,0,.09,0,0,-.04,.5,.025,-.04,.5,.025,.09,0,0,.04,.5,.025,-.04,.5,.025,.04,.5,.025,.05,.85,.08,0,0,-.09,0,0,.09,.02,.5,-.04,.02,.5,-.04,0,0,.09,.02,.5,.04,.02,.5,-.04,.02,.5,.04,.08,.85,.05],3));geo.computeVertexNormals();
  let m=mat('#ffffff',{side:T.DoubleSide,roughness:1});m.onBeforeCompile=s=>{Object.assign(s.uniforms,this.uniforms);s.vertexShader='uniform float uTime; varying float vBlade;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vBlade=position.y;float sway=sin(uTime*1.5+instanceMatrix[3].x*.17+instanceMatrix[3].z*.12);transformed.x+=sway*.19*position.y*position.y;`);s.fragmentShader='uniform vec3 uGround;uniform float uWinter;varying float vBlade;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   diffuseColor.rgb*=mix(uGround*.65,uGround*1.32,smoothstep(0.,.8,vBlade));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.83,.89,.88),uWinter*.8);`)};
  let grass=new T.InstancedMesh(geo,m,positions.length);grass.receiveShadow=true;for(let i=0;i<positions.length;i++){let [x,y,z]=positions[i];temp.position.set(x,y-.08,z);temp.rotation.set(0,rand()*6.28,0);let s=.5+rand()*1.1;temp.scale.set(s,s,s);temp.updateMatrix();grass.setMatrixAt(i,temp.matrix);grass.setColorAt(i,new T.Color().setScalar(.65+rand()*.45))}this.scene.add(grass);this.grass=grass;
  const flowerPositions=positions.filter((p,i)=>i%25===0);let fgeo=new T.SphereGeometry(.10,5,4),fm=mat('#e4dfc1');let flowers=new T.InstancedMesh(fgeo,fm,flowerPositions.length);flowerPositions.forEach(([x,y,z],i)=>{temp.position.set(x,y+.45+rand()*.35,z);temp.scale.set(1,.5,1);temp.rotation.set(0,0,0);temp.updateMatrix();flowers.setMatrixAt(i,temp.matrix);flowers.setColorAt(i,new T.Color([0xe4ddba,0xa4acd9,0xd7bd8f,0xd0d9b7][i%4]))});this.scene.add(flowers);this.flowers=flowers;
 }
 makePlants(){
  this.plantMats=species.map(s=>mat(s.color));const stems=mat('#597c40');
  for(let i=0;i<100;i++){let type=i%4,x,z;if(type===2){x=-210+(rand()-.5)*160;z=-130+(rand()-.5)*170}else if(type===3){x=-225+(rand()-.5)*130;z=-400+(rand()-.5)*130}else{x=-85+(rand()-.5)*240;z=80+(rand()-.5)*240}if(lakeDistance(x,z)<1.15||elevation(x,z)<10)continue;let g=new T.Group();g.position.set(x,elevation(x,z),z);
   if(type===2){for(let j=0;j<3;j++){let dx=(rand()-.5)*.7,dz=(rand()-.5)*.7;cylinder(g,this.mats.plaster,v3(dx,0,dz),v3(dx,.4+j*.1,dz),.05,.04,5);let cap=ellipsoid(g,this.plantMats[type],dx,.42+j*.1,dz,.24,.13,.24)}}else{for(let j=0;j<5;j++){let a=j*2.4,dx=Math.cos(a)*.22,dz=Math.sin(a)*.22;cylinder(g,stems,v3(0,0,0),v3(dx,.6+j*.04,dz),.018,.008,4);if(type===0){let leaf=ellipsoid(g,this.plantMats[0],dx,.35,dz,.035,.38,.08);leaf.rotation.z=Math.cos(a)*.5}else{for(let k=0;k<5;k++){let b=k*6.28/5;ellipsoid(g,this.plantMats[type],dx+Math.cos(b)*.11,.65+j*.04,dz+Math.sin(b)*.11,.1,.035,.075)}ellipsoid(g,this.plantMats[0],dx,.65+j*.04,dz,.045,.04,.045)}}}
   this.scene.add(g);this.plants.push({group:g,type,x,z,collectedAt:-1000});
  }
  // A patch by the starting path makes the first collection easy to discover.
  for(let j=0;j<4;j++){let source=this.plants.find(p=>p.type===j);if(source){source.x=-44+j*2;source.z=j===0?60:57;source.group.position.set(source.x,elevation(source.x,source.z),source.z)}}
  for(const [type,x,z] of [[0,-83,117],[1,14,4],[2,-209,-129],[3,-259,-469]]){let source=this.plants.find(p=>p.type===type&&Math.hypot(p.x+44,p.z-57)>20);if(source){source.x=x;source.z=z;source.group.position.set(x,elevation(x,z),z)}}
 }
 makeWater(){
  this.reflectionTarget=new T.WebGLRenderTarget(this.low?256:512,this.low?256:512);this.reflectionCamera=new T.PerspectiveCamera();this.reflectionMatrix=new T.Matrix4();
  const uniforms={uTime:this.uniforms.uTime,uDay:{value:1},uSky:{value:new T.Color('#a2bfc5')},uSun:{value:v3(-.5,.7,-.3)},uWinter:this.uniforms.uWinter,uReflection:{value:this.reflectionTarget.texture},uTextureMatrix:{value:this.reflectionMatrix},uHasReflection:{value:0}};this.waterUniforms=uniforms;
  const waterMat=new T.ShaderMaterial({uniforms,vertexShader:`varying vec3 vWP;varying vec3 vView;varying vec4 vMirror;uniform mat4 uTextureMatrix;uniform float uTime;void main(){vec3 p=position;p.y+=sin(p.x*.11+uTime*.8)*.035+sin(p.z*.17-uTime*.65)*.025;vec4 w=modelMatrix*vec4(p,1.);vWP=w.xyz;vView=cameraPosition-w.xyz;vMirror=uTextureMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`precision highp float;varying vec3 vWP;varying vec3 vView;varying vec4 vMirror;uniform sampler2D uReflection;uniform float uHasReflection;uniform float uTime;uniform float uDay;uniform float uWinter;uniform vec3 uSky;uniform vec3 uSun;${noiseGLSL}
   void main(){vec2 p=vWP.xz;float t=uTime;float w1=sin(p.x*.35+p.y*.11+t*.7);float w2=sin(p.y*.43-p.x*.15-t*.5);vec3 n=normalize(vec3(w1*.075,1.,w2*.075));vec3 v=normalize(vView);float fres=pow(1.-max(0.,dot(n,v)),3.);vec3 deep=vec3(.035,.26,.27);vec3 shallow=vec3(.16,.46,.42);float sw=nse(p*.035);vec3 c=mix(deep,shallow,sw*.5);c=mix(c,uSky,fres*.5);vec2 uv=vMirror.xy/vMirror.w+n.xz*.007;vec3 reflection=texture2D(uReflection,uv).rgb;c=mix(c,reflection,(.38+fres*.5)*uHasReflection*(1.-uWinter*.75));float spec=pow(max(0.,dot(reflect(-normalize(uSun),n),v)),130.);float rip=pow(max(0.,sin(p.x*2.6+p.y*3.8+t)),16.)*.009;c+=vec3(1.,.9,.7)*spec*.8+rip;c*=.21+.79*uDay;c=mix(c,vec3(.62,.76,.78)*(.3+uDay*.7),uWinter*.75);float dist=length(vView);float haze=smoothstep(350.,1800.,dist);c=mix(c,uSky,haze*.65);gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`,side:T.DoubleSide});
  // An irregular shore line avoids the perfect-circle look of a primitive lake.
  let vs=[lake.x,lake.y,lake.z],idx=[];let N=128;for(let i=0;i<=N;i++){let a=i/N*Math.PI*2,scale=1.02+.014*Math.sin(a*7);vs.push(lake.x+Math.cos(a)*lake.rx*scale,lake.y,lake.z+Math.sin(a)*lake.rz*scale);if(i<N)idx.push(0,i+1,i+2)}let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vs,3));g.setIndex(idx);g.computeVertexNormals();let lakeMesh=mesh(g,waterMat,this.scene);lakeMesh.castShadow=false;this.water.push(lakeMesh);
  let rv=[],ri=[];for(let i=0;i<=170;i++){let z=18+i*3.5,x=streamX(z),w=4.7+Math.sin(z*.043)*.6;rv.push(x-w,lake.y-.04,z,x+w,lake.y-.04,z);if(i<170){let k=i*2;ri.push(k,k+2,k+1,k+1,k+2,k+3)}}let rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(rv,3));rg.setIndex(ri);rg.computeVertexNormals();let river=mesh(rg,waterMat,this.scene);river.castShadow=false;this.water.push(river);
  // Shore reeds, pale pebbles, and ripples anchor the water in the landscape.
  let reedMat=mat('#8d9764');let reedGeo=new T.CylinderGeometry(.025,.045,1.2,4);let reeds=new T.InstancedMesh(reedGeo,reedMat,220);for(let i=0;i<220;i++){let a=rand()*6.28;let x=lake.x+Math.cos(a)*lake.rx*(1.04+rand()*.045),z=lake.z+Math.sin(a)*lake.rz*(1.04+rand()*.045);temp.position.set(x,Math.max(elevation(x,z),lake.y)+.5,z);temp.rotation.set((rand()-.5)*.2,0,(rand()-.5)*.2);temp.scale.set(1,.7+rand()*.7,1);temp.updateMatrix();reeds.setMatrixAt(i,temp.matrix)}this.scene.add(reeds);this.reeds=reeds;
 }
 makeVillage(){
  const houses=[[-68,21,10,8,0],[-42,2,9,7,.1],[-92,-8,8,7,-.1],[-101,44,11,8,.08],[-34,37,8,6,-.12],[-61,-30,9,7,.16],[-119,15,7,6,0]];
  for(let i=0;i<houses.length;i++){let [x,z,w,d,r]=houses[i];this.house(x,z,w,d,r,i)}
  // Timber footbridge, with rails and individual planks.
  let bx=streamX(90),by=lake.y+3.5,g=new T.Group();g.position.set(bx,by,90);for(let i=-12;i<=12;i++){let deck=box(g,this.mats.wood,i*.63,Math.sin((i+12)/24*Math.PI)*.4,0,.6,.24,3.6);deck.receiveShadow=true}for(let side of [-1,1]){for(let i=-3;i<=3;i++)box(g,this.mats.fence,i*2.4,1.1,side*1.7,.18,2,.18);cylinder(g,this.mats.wood,v3(-7.2,1.6,side*1.7),v3(7.2,1.6,side*1.7),.09)}this.scene.add(g);this.bridge={x:bx,z:90,y:by+.4};
  // Low wooden fences leave wide openings for horses and walkers.
  for(const [x,z,len,dir] of [[-125,88,75,0],[-125,155,75,0],[-144,121,67,Math.PI/2],[-21,84,28,0]]){let y=elevation(x,z);for(let t=0;t<len;t+=5){let px=x+Math.cos(dir)*t,pz=z+Math.sin(dir)*t,py=elevation(px,pz);box(this.scene,this.mats.fence,px,py+.8,pz,.15,1.65,.15);if(t+5<len)for(let h of [.65,1.25]){let end=v3(px+Math.cos(dir)*5,elevation(px+Math.cos(dir)*5,pz+Math.sin(dir)*5)+h,pz+Math.sin(dir)*5);cylinder(this.scene,this.mats.fence,v3(px,py+h,pz),end,.055,.055,5)}}}
  // Trail cairns make the climb legible without locking the route.
  for(let i=0;i<26;i++){let t=i/25,x=mix(-175,-260,t)+Math.sin(t*13)*15,z=mix(-180,-470,t);let y=elevation(x,z);for(let k=0;k<3;k++){let rock=mesh(new T.IcosahedronGeometry(.5-k*.1,0),this.mats.rock,this.scene,x,y+k*.5,z);rock.scale.y=.55}}
  this.makePrayerFlags(-114,65,-22,67);this.makePrayerFlags(24,-15,31,-38);
  // A small trail sign by the first house.
  let sx=-44,sz=52,sy=elevation(sx,sz);box(this.scene,this.mats.wood,sx,sy+1.3,sz,.15,2.6,.15);const sign=box(this.scene,this.mats.wood,sx,sy+2.05,sz,2.6,.5,.16);let c=document.createElement('canvas');c.width=512;c.height=128;let ctx=c.getContext('2d');ctx.fillStyle='#68503b';ctx.fillRect(0,0,512,128);ctx.fillStyle='#dfddbf';ctx.font='40px serif';ctx.textAlign='center';ctx.fillText('映雪海子 →',256,83);let tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;mesh(new T.PlaneGeometry(2.5,.45),new T.MeshBasicMaterial({map:tx}),this.scene,sx,sy+2.05,sz+.09);
 }
 house(x,z,w,d,r,index){let y=elevation(x,z),g=new T.Group();g.position.set(x,y-.3,z);g.rotation.y=r;let m=this.mats;
  box(g,m.stone,0,.7,0,w+.6,1.4,d+.6);box(g,m.plaster,0,2.7,0,w,4.3,d);
  for(let side of [-1,1]){box(g,m.darkwood,side*(w/2-.12),2.9,d/2+.06,.22,4.5,.25);box(g,m.darkwood,side*(w/2-.12),2.9,-d/2-.06,.22,4.5,.25)}
  for(let h of [1.2,4.7])box(g,m.darkwood,0,h,d/2+.1,w,.23,.25);
  // Gabled roof with visible eaves and timber ends.
  const shape=new T.Shape();shape.moveTo(-w/2-.7,4.8);shape.lineTo(0,7.1);shape.lineTo(w/2+.7,4.8);shape.lineTo(w/2+.7,4.55);shape.lineTo(0,6.85);shape.lineTo(-w/2-.7,4.55);shape.closePath();let roof=mesh(new T.ExtrudeGeometry(shape,{depth:d+1.5,bevelEnabled:false}),m.roof,g,0,0,-d/2-.75);this.seasonal.push(roof);for(let xx=-w/2;xx<=w/2;xx+=.55){let yy=7.12-Math.abs(xx)/(w/2+.7)*2.3;box(g,m.darkwood,xx,yy+.015,0,.035,.035,d+1.5)}
  let snowRoof=roof.clone();snowRoof.material=m.snow;snowRoof.position.y+=.12;snowRoof.visible=false;g.add(snowRoof);this.seasonal.push(snowRoof);snowRoof.userData.snow=true;
  box(g,m.wood,0,1.8,d/2+.12,1.4,2.7,.15);ellipsoid(g,m.window,.45,1.8,d/2+.24,.07,.07,.05);
  for(let side of [-1,1]){let wx=side*(w*.3),wy=2.7,wz=d/2+.14;box(g,m.darkwood,wx,wy,wz,1.6,1.7,.22);let wm=m.window.clone();box(g,wm,wx,wy,wz+.13,1.3,1.35,.06);this.windows.push(wm);box(g,m.wood,wx,wy,wz+.18,.07,1.4,.06);box(g,m.wood,wx,wy,wz+.18,1.35,.07,.06);box(g,m.darkwood,wx,wy-.92,wz+.3,1.8,.15,.6)}
  box(g,m.stone,0,.35,d/2+1.1,3,.5,1.8);box(g,m.wood,w*.32,6.1,-d*.2,.65,2.2,.65);
  let smokeGroup=new T.Group();smokeGroup.position.set(w*.32,7.3,-d*.2);for(let j=0;j<5;j++){let sm=new T.Mesh(new T.SphereGeometry(.8+j*.25,6,5),new T.MeshBasicMaterial({color:'#d3d7cf',transparent:true,opacity:.1,depthWrite:false}));sm.position.set(j*.15,j*.7,0);smokeGroup.add(sm)}this.smoke.push(smokeGroup);g.add(smokeGroup);
  if(index<3){let light=new T.PointLight('#ffbc6d',0,18,2);light.position.set(0,2.5,d/2+1);g.add(light);this.windows.push(light)}
  this.scene.add(g);this.colliders.push({x,z,r:Math.max(w,d)*.56});
 }
 makePrayerFlags(x,z,xx,zz){let y=elevation(x,z)+4,yy=elevation(xx,zz)+4;for(let [a,b,h] of [[x,z,y],[xx,zz,yy]])box(this.scene,this.mats.darkwood,a,h-2,b,.12,4,.12);let a=v3(x,y,z),b=v3(xx,yy,zz);cylinder(this.scene,this.mats.darkwood,a,b,.016,.016,4);const colors=['#b4b3a5','#bcb27a','#998b72','#748e93','#a28172'];for(let i=1;i<24;i++){let p=a.clone().lerp(b,i/24);let flag=mesh(new T.PlaneGeometry(.6,.85,2,3),mat(colors[i%5],{side:T.DoubleSide}),this.scene,p.x,p.y-.4,p.z);flag.rotation.y=Math.atan2(xx-x,zz-z)+Math.PI/2;this.flags??=[];this.flags.push(flag)}}
 makeAnimals(){
  this.horse=this.animal('horse',-37,64,0);this.dog=this.animal('dog',-44,59,1);
  for(let i=0;i<5;i++)this.animal('yak',-104+rand()*52,103+rand()*35,i+2);
 }
 animal(type,x,z,index){let g=new T.Group(),coat=mat(type==='horse'?'#79604b':type==='dog'?'#927d52':index%2?'#423b32':'#655b4a',{map:texturedCanvas('fur')}),dark=mat('#2e2c26'),cream=mat('#d7c8a5'),hooves=mat('#373a33');let legs=[],tail;
  if(type==='horse'){
   ellipsoid(g,coat,0,1.65,0,.53,.65,1.03);ellipsoid(g,coat,0,1.76,-.77,.43,.6,.4);cylinder(g,coat,v3(0,1.8,-.65),v3(0,2.75,-1.05),.31,.20,10);ellipsoid(g,coat,0,2.73,-1.25,.22,.29,.48);ellipsoid(g,dark,0,2.62,-1.57,.18,.17,.16);for(let s of [-1,1]){let e=ellipsoid(g,coat,s*.14,3.05,-1.1,.075,.23,.09);e.rotation.z=s*.15;ellipsoid(g,dark,s*.215,2.85,-1.25,.025,.04,.05)}box(g,dark,0,2.02,-.79,.16,.6,.6);for(let i=0;i<8;i++)ellipsoid(g,dark,0,2.1+i*.08,-.73-i*.04,.12,.14,.12);
   tail=cylinder(g,dark,v3(0,1.9,.92),v3(.05,.6,1.28),.09,.12,6);box(g,mat('#403b2d'),0,2.22,.05,.88,.16,.75);box(g,mat('#9a7651'),0,2.34,.1,.65,.14,.62);
  }else if(type==='yak'){
   ellipsoid(g,coat,0,1.3,0,.72,.77,1.2);ellipsoid(g,coat,0,1.7,-.58,.7,.76,.6);ellipsoid(g,coat,0,1.15,-1.23,.42,.42,.49);ellipsoid(g,dark,0,.99,-1.55,.3,.18,.22);
   // Shaggy skirt made of irregular hanging tufts, not a smooth cow silhouette.
   for(let i=0;i<28;i++){let a=i/28*6.28;let tuft=mesh(new T.ConeGeometry(.16,.65+rand()*.35,5),coat,g,Math.cos(a)*.6,.68,Math.sin(a)*1.05);tuft.rotation.z=Math.PI+(rand()-.5)*.4}
   for(let s of [-1,1]){let path=new T.CatmullRomCurve3([v3(s*.28,1.5,-1.18),v3(s*.63,1.62,-1.18),v3(s*.73,1.95,-1.23),v3(s*.64,2.14,-1.35)]);mesh(new T.TubeGeometry(path,9,.065,5,false),cream,g);ellipsoid(g,coat,s*.45,1.5,-1.14,.24,.09,.13);ellipsoid(g,dark,s*.32,1.33,-1.46,.03,.04,.04)}tail=cylinder(g,dark,v3(0,1.35,1.1),v3(.1,.6,1.6),.045,.08,5);
   let bell=mesh(new T.SphereGeometry(.12,6,5),mat('#a58b4d',{metalness:.45,roughness:.45}),g,0,.74,-1.0);bell.scale.y=1.2;
  }else{
   ellipsoid(g,coat,0,.65,0,.25,.32,.54);ellipsoid(g,coat,0,.91,-.47,.25,.26,.27);ellipsoid(g,cream,0,.85,-.69,.14,.13,.2);ellipsoid(g,dark,0,.87,-.86,.075,.055,.06);for(let s of [-1,1]){let ear=mesh(new T.ConeGeometry(.08,.23,10),dark,g,s*.17,1.17,-.43);ear.rotation.z=s*.26;ellipsoid(g,dark,s*.16,.99,-.65,.025,.035,.035)}let path=new T.CatmullRomCurve3([v3(0,.78,.47),v3(.05,1.04,.75),v3(.05,1.3,.64),v3(.05,1.25,.48)]);tail=mesh(new T.TubeGeometry(path,10,.075,6,false),coat,g);box(g,mat('#698c81'),0,.85,-.35,.41,.10,.15);
  }
  if(type==='dog'){ellipsoid(g,dark,0,.82,.08,.245,.2,.4);ellipsoid(g,coat,0,.83,-.32,.24,.27,.2);ellipsoid(g,dark,0,.84,-.76,.12,.1,.17)}
  let dog=type==='dog',yak=type==='yak';for(let s of [-1,1])for(let f of [-1,1]){let p=new T.Group();let px=s*(dog?.17:yak?.47:.32),pz=f*(dog?.35:yak?.75:.67),height=dog?.6:yak?1.0:1.5;p.position.set(px,height,pz);cylinder(p,coat,v3(0,0,0),v3(0,-height+.12,0),dog?.055:yak?.12:.09,dog?.055:yak?.10:.075,10);if(dog){ellipsoid(p,coat,0,-height+.075,-.04,.075,.07,.14);ellipsoid(p,coat,0,-.1,0,.09,.20,.12)}else{box(p,hooves,0,-height+.08,-.02,.22,.16,.28);ellipsoid(p,coat,0,-.15,0,yak?.17:.14,.27,.18)}g.add(p);legs.push(p)}
  let a={type,group:g,legs,tail,x,z,index,homeX:x,homeZ:z,angle:rand()*6.28,phase:rand()*6.28,fed:false,target:null,pet:false,calling:false};g.position.set(x,elevation(x,z),z);this.animals.push(a);this.scene.add(g);return a;
 }
 makeSky(){
  this.skyUniforms={uSun:{value:v3(-.5,.6,-.5)},uDay:{value:1},uCloud:{value:0},uTime:this.uniforms.uTime};
  let skyMat=new T.ShaderMaterial({uniforms:this.skyUniforms,side:T.BackSide,depthWrite:false,vertexShader:'varying vec3 vDir;void main(){vDir=position;vec4 p=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.);gl_Position=p.xyww;}',fragmentShader:`varying vec3 vDir;uniform vec3 uSun;uniform float uDay;uniform float uCloud;uniform float uTime;${noiseGLSL}
   void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 day=mix(vec3(.72,.79,.75),vec3(.27,.48,.62),pow(h,.5));float dusk=pow(1.-abs(uDay-.25)*1.25,5.)*(1.-smoothstep(0.,.45,h));day=mix(day,vec3(.77,.55,.40),dusk*.45);vec3 night=mix(vec3(.075,.115,.16),vec3(.013,.033,.075),pow(h,.4));vec3 col=mix(night,day,uDay);float sun=dot(d,normalize(uSun));col+=vec3(1.,.85,.60)*pow(max(sun,0.),380.)*uDay*2.;col+=vec3(1.,.74,.43)*pow(max(sun,0.),12.)*.18*uDay;
   vec2 p=d.xz/max(d.y+.16,.08)*1.4+uTime*.0015;float clouds=nse(p*2.)*.5+nse(p*4.)*.28+nse(p*8.)*.13+nse(p*16.)*.07;float c=smoothstep(.51-uCloud*.13,.7-uCloud*.1,clouds)*smoothstep(-.03,.2,d.y);col=mix(col,mix(vec3(.11,.16,.20),vec3(.89,.88,.80),uDay),c*(.55+uCloud*.35));
   float stars=step(.9987,hsh(floor(d.xz/max(d.y,.12)*450.)))*smoothstep(.1,.4,d.y)*(1.-uDay);col+=vec3(stars*.65);float moon=pow(max(dot(d,-normalize(uSun)),0.),1600.)*(1.-uDay);col+=vec3(.7,.77,.8)*moon;gl_FragColor=vec4(col,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});this.sky=new T.Mesh(new T.SphereGeometry(1800,24,16),skyMat);this.sky.frustumCulled=false;this.sky.renderOrder=-100;this.scene.add(this.sky);
  let pts=new Float32Array((this.low?900:1800)*3);for(let i=0;i<pts.length;i+=3){pts[i]=(rand()-.5)*140;pts[i+1]=rand()*70;pts[i+2]=(rand()-.5)*140}let pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(pts,3));let tex=document.createElement('canvas');tex.width=tex.height=32;let ctx=tex.getContext('2d'),gr=ctx.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gr;ctx.fillRect(0,0,32,32);this.precip=new T.Points(pg,new T.PointsMaterial({color:'#e9f1eb',size:.23,map:new T.CanvasTexture(tex),transparent:true,opacity:0,depthWrite:false}));this.precip.frustumCulled=false;this.scene.add(this.precip);
  // Slow soaring birds and small points of light on warm evenings.
  this.birds=[];for(let i=0;i<9;i++){let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-.9,0,.2,0,.12,0,0,.12,0,.9,0,.2],3));let b=new T.LineSegments(geo,new T.LineBasicMaterial({color:'#415153'}));b.userData.phase=rand()*6.28;this.scene.add(b);this.birds.push(b)}
 }
 renderReflection(renderer,camera){
  if(this.low)return;let c=this.reflectionCamera;c.copy(camera);let dir=camera.getWorldDirection(new T.Vector3()),target=camera.position.clone().add(dir);target.y=2*lake.y-target.y;c.position.copy(camera.position);c.position.y=2*lake.y-camera.position.y;c.up.set(0,-1,0);c.lookAt(target);c.updateMatrixWorld();c.matrixWorldInverse.copy(c.matrixWorld).invert();
  this.reflectionMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
  // Clip with the reflection camera's projection, avoiding an extra shader variant for every material.
  let plane=new T.Plane(new T.Vector3(0,1,0),-lake.y+.1).applyMatrix4(c.matrixWorldInverse),clip=new T.Vector4(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant),p=c.projectionMatrix.elements;
  let q=new T.Vector4((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);clip.multiplyScalar(2/clip.dot(q));p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.001;p[14]=clip.w;
  const old=renderer.getRenderTarget();this.water.forEach(w=>w.visible=false);let vis=this.precip.visible;this.precip.visible=false;renderer.setRenderTarget(this.reflectionTarget);renderer.render(this.scene,c);renderer.setRenderTarget(old);this.water.forEach(w=>w.visible=true);this.precip.visible=vis;this.waterUniforms.uHasReflection.value=1;
 }
 setSeason(value){this.season=value;let i=Math.round(value)%4;this.uniforms.uSeason.value=value;this.birchMat.color.set(['#a9b77c','#7c9c58','#c8a052','#83867b'][i]);this.birches.visible=i!==3;this.flowers.visible=i!==3;this.reeds.visible=i!==3;for(let o of this.seasonal)if(o.userData.snow)o.visible=i===3;this.updatePlants();}
 updatePlants(){let i=Math.round(this.season)%4;for(let p of this.plants)p.group.visible=this.time-p.collectedAt>60&&species[p.type].season.includes(i)}
 update(dt,t,player,state){this.time=t;this.uniforms.uTime.value=t;const day=state.day,sunDir=state.sunDir;this.sky.position.copy(player);this.skyUniforms.uSun.value.copy(sunDir);this.skyUniforms.uDay.value=day;this.skyUniforms.uCloud.value=state.weather==='clear'?0:state.weather==='cloudy'?.55:.9;this.waterUniforms.uDay.value=day;this.waterUniforms.uSun.value.copy(sunDir);this.waterUniforms.uSky.value.copy(state.skyColor);
  for(let w of this.windows){if(w.isLight)w.intensity=(1-day)*55;else w.emissiveIntensity=(1-day)*2.5}
  for(let i=0;i<this.smoke.length;i++){let g=this.smoke[i];for(let j=0;j<g.children.length;j++){let p=g.children[j];p.position.y=(t*.4+j*.8)%4;p.position.x=Math.sin(t*.3+j)*.25+p.position.y*.28;p.material.opacity=(1-p.position.y/4)*.11}}
  for(let f of this.flags||[])f.rotation.z=Math.sin(t*2+f.position.x)*.12;
  for(let a of this.animals){if(state.riding&&a.type==='horse'){a.group.visible=true;a.group.position.set(a.x,elevation(a.x,a.z),a.z);a.group.rotation.y=a.angle;for(let j=0;j<a.legs.length;j++)a.legs[j].rotation.x=state.moving?Math.sin(t*(state.running?13:8)+j%2*Math.PI+(j>1?Math.PI:0))*.4:0;continue}a.group.visible=true;let d=Math.hypot(player.x-a.x,player.z-a.z),moving=false,speed=0;
   if((a.type==='dog'&&(state.dogAdopted||a.calling)&&d>3.1)||(a.type==='horse'&&a.calling&&d>4)){let dx=player.x-a.x,dz=player.z-a.z;a.angle=Math.atan2(-dx,-dz);speed=a.type==='dog'?5.2:6;moving=true;if(d>100){a.x=player.x+6;a.z=player.z+5}}
   else if(a.type==='yak'||(a.type==='dog'&&!state.dogAdopted&&!a.calling)){a.angle+=Math.sin(t*.09+a.phase)*dt*.2;moving=Math.sin(t*.13+a.phase)>.25;speed=a.type==='yak'?.45:1.2;if(Math.hypot(a.x-a.homeX,a.z-a.homeZ)>22)a.angle=Math.atan2(a.x-a.homeX,a.z-a.homeZ)}
   if(moving){let nx=a.x-Math.sin(a.angle)*speed*dt,nz=a.z-Math.cos(a.angle)*speed*dt;if(elevation(nx,nz)>9.5&&lakeDistance(nx,nz)>1.08){a.x=nx;a.z=nz}else a.angle+=dt}
   if(a.calling&&d<4&&a.type==='horse')a.calling=false;a.group.position.set(a.x,elevation(a.x,a.z)+(moving?Math.sin(t*speed*3)*.035:0),a.z);a.group.rotation.y=a.angle;for(let j=0;j<a.legs.length;j++)a.legs[j].rotation.x=moving?Math.sin(t*speed*3+j%2*Math.PI+(j>1?Math.PI:0))*(a.type==='dog'?.55:.3):Math.sin(t*.5+a.phase)*.015;if(a.tail)a.tail.rotation.z+=(Math.sin(t*4+a.phase)*.003);}
  let rain=state.weather==='rain',snow=state.weather==='snow';this.precip.visible=rain||snow;if(this.precip.visible){this.precip.material.opacity=rain?.35:.75;this.precip.material.size=rain?.085:.24;this.precip.position.set(player.x,player.y-8,player.z);let p=this.precip.geometry.attributes.position;for(let i=0;i<p.count;i++){let y=p.getY(i)-dt*(rain?32:2.8);if(y<0)y=70;p.setY(i,y);p.setX(i,p.getX(i)+Math.sin(t*.3+i)*dt*(rain?.2:.4))}p.needsUpdate=true}
  this.birds.forEach((b,i)=>{let a=t*.035+i*.75;b.position.set(-10+Math.cos(a)*140,55+Math.sin(a*.5+i)*12,-90+Math.sin(a)*90);b.rotation.y=-a;b.rotation.z=Math.sin(t*1.8+i)*.05;b.scale.y=.5+Math.sin(t*3+i)*.4});
 }
}
function hash3(x,y,z){return(Math.sin(x*13.1+y*37.9+z*57.3)*43758.5)%1*.5+.5}









