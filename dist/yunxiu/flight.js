import * as T from'../vendor/three.module.js';
import{ALT_BASE,MIN_X,MAX_X,MIN_Z,MAX_Z,clamp}from'./core.js';
import{MAX_ALTITUDE}from'./life-rules.js?v=travel-1';
export function flightStep(position,dx,dz,vertical,seconds,geo){
 const endX=clamp(position.x+dx,MIN_X+1,MAX_X-1),endZ=clamp(position.z+dz,MIN_Z+1,MAX_Z-1),ceiling=MAX_ALTITUDE-ALT_BASE,startY=clamp(position.y,geo.height(position.x,position.z)+3.2,ceiling),endY=clamp(startY+vertical*seconds,-Infinity,ceiling),steps=Math.max(1,Math.ceil(Math.hypot(endX-position.x,endZ-position.z)/4));let x=position.x,z=position.z;
 for(let i=1;i<=steps;i++){const t=i/steps,xx=position.x+(endX-position.x)*t,zz=position.z+(endZ-position.z)*t,y=startY+(endY-startY)*t;if(geo.height(xx,zz)+3.2>y)break;x=xx;z=zz;}
 return{x,z,y:clamp(Math.max(endY,geo.height(x,z)+3.2),-Infinity,ceiling)};
}
// A deliberately simple control-test proxy. Approved concept art will determine
// the final mesh, membrane materials, saddle and animation rig.
export class WindRider{
 constructor(scene){this.group=new T.Group();this.wings=[];const skin=new T.MeshStandardMaterial({color:'#c9bd9b',roughness:.83}),membrane=new T.MeshStandardMaterial({color:'#d9caa0',roughness:.7,side:T.DoubleSide});
  const ball=(p,s,m=skin)=>{const o=new T.Mesh(new T.SphereGeometry(1,16,10),m);o.position.set(...p);o.scale.set(...s);o.castShadow=true;this.group.add(o);return o;};
  ball([0,0,0],[.48,.55,1.45]);ball([0,.3,1.2],[.20,.34,.82]);this.neck=new T.Group();this.neck.position.set(0,.35,1.2);this.group.add(this.neck);const neck=ball([0,.75,.5],[.16,.9,.21]);this.group.remove(neck);this.neck.add(neck);this.head=new T.Group();this.head.position.set(0,1.5,1.45);this.neck.add(this.head);const head=ball([0,0,0],[.22,.23,.6]);this.group.remove(head);this.head.add(head);
  const beak=new T.Mesh(new T.ConeGeometry(.2,1.9,4),skin);beak.rotation.x=Math.PI/2;beak.position.set(0,-.02,1.25);this.head.add(beak);const crest=new T.Mesh(new T.ConeGeometry(.24,1.05,3),new T.MeshStandardMaterial({color:'#bf895c',roughness:.8}));crest.rotation.x=-.9;crest.position.set(0,.4,-.45);this.head.add(crest);this.legs=[];
  for(const side of[-1,1]){const wing=new T.Group(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*.2,.2,.6,side*2.7,.15,.9,side*5.45,-.08,1.2,side*3.2,-.2,-.9,side*.35,-.25,-1.3],3));g.setIndex([0,1,4,1,3,4,1,2,3]);g.computeVertexNormals();const w=new T.Mesh(g,membrane);w.castShadow=true;wing.add(w);this.group.add(wing);this.wings.push({wing,side});const leg=new T.Group();leg.position.set(side*.28,-.25,-.75);this.group.add(leg);for(const p of[[[0,-.4,0],[.12,.6,.16]],[[side*.03,-.85,.5],[.14,.10,.45]]]){const m=ball(...p);this.group.remove(m);leg.add(m);}this.legs.push(leg);const eye=ball([side*.2,.10,.3],[.055,.055,.055],new T.MeshStandardMaterial({color:'#302d21',roughness:.5}));this.group.remove(eye);this.head.add(eye);}
  const saddle=new T.Mesh(new T.BoxGeometry(.6,.16,.75),new T.MeshStandardMaterial({color:'#796348',roughness:.94}));saddle.position.set(0,.48,.15);this.group.add(saddle);this.group.visible=false;scene.add(this.group);
 }
 update(time,player,yaw,flying,moving,boost=false,dt=1/60){this.group.visible=flying;if(!flying)return;const target=boost&&moving?1:0;this.sprint=T.MathUtils.lerp(this.sprint||0,target,1-Math.exp(-dt*9));const sprint=this.sprint;this.group.position.set(player.x,player.y-.7,player.z);this.group.rotation.set(0,yaw+Math.PI,0);this.neck.rotation.x=.9*sprint;this.head.rotation.x=-this.neck.rotation.x;for(const w of this.wings){w.wing.rotation.y=w.side*.95*sprint;w.wing.scale.x=1-.45*sprint;w.wing.rotation.z=w.side*(Math.sin(time*(moving?2.6:1.8))*.18*(1-sprint)+.035*sprint);}for(const leg of this.legs)leg.rotation.x=-.9*sprint;}
}
