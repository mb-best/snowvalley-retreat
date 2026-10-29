import * as T from'../vendor/three.module.js';
import{ALT_BASE,MIN_X,MAX_X,MIN_Z,MAX_Z,clamp}from'./core.js';
import{BASE_SPEED,MAX_ALTITUDE}from'./life-rules.js';
export function flightStep(position,dx,dz,vertical,seconds,geo){const x=clamp(position.x+dx,MIN_X+1,MAX_X-1),z=clamp(position.z+dz,MIN_Z+1,MAX_Z-1),floor=geo.height(x,z)+3.2;return{x,z,y:clamp(position.y+vertical*seconds,floor,MAX_ALTITUDE-ALT_BASE)};}
// A deliberately simple control-test proxy. Approved concept art will determine
// the final mesh, membrane materials, saddle and animation rig.
export class WindRider{
 constructor(scene){this.group=new T.Group();this.wings=[];const skin=new T.MeshStandardMaterial({color:'#c9bd9b',roughness:.83}),membrane=new T.MeshStandardMaterial({color:'#d9caa0',roughness:.7,side:T.DoubleSide});
  const ball=(p,s,m=skin)=>{const o=new T.Mesh(new T.SphereGeometry(1,16,10),m);o.position.set(...p);o.scale.set(...s);o.castShadow=true;this.group.add(o);return o;};
  ball([0,0,0],[.48,.55,1.45]);ball([0,.3,1.2],[.20,.34,.82]);ball([0,1.1,2.15],[.16,.85,.21]);ball([0,1.85,2.65],[.22,.23,.6]);
  const beak=new T.Mesh(new T.ConeGeometry(.2,1.9,4),skin);beak.rotation.x=Math.PI/2;beak.position.set(0,1.83,3.9);this.group.add(beak);const crest=new T.Mesh(new T.ConeGeometry(.24,1.05,3),new T.MeshStandardMaterial({color:'#bf895c',roughness:.8}));crest.rotation.x=-.9;crest.position.set(0,2.25,2.2);this.group.add(crest);
  for(const side of[-1,1]){const wing=new T.Group(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([side*.2,.2,.6,side*2.7,.15,.9,side*5.45,-.08,1.2,side*3.2,-.2,-.9,side*.35,-.25,-1.3],3));g.setIndex([0,1,4,1,3,4,1,2,3]);g.computeVertexNormals();const w=new T.Mesh(g,membrane);w.castShadow=true;wing.add(w);this.group.add(wing);this.wings.push({wing,side});ball([side*.28,-.65,-.75],[.12,.6,.16]);ball([side*.31,-1.10,-.25],[.14,.10,.45]);ball([side*.2,1.95,2.95],[.055,.055,.055],new T.MeshStandardMaterial({color:'#302d21',roughness:.5}));}
  const saddle=new T.Mesh(new T.BoxGeometry(.6,.16,.75),new T.MeshStandardMaterial({color:'#796348',roughness:.94}));saddle.position.set(0,.48,.15);this.group.add(saddle);this.group.visible=false;scene.add(this.group);
 }
 update(time,player,yaw,flying,moving){this.group.visible=flying;if(!flying)return;this.group.position.set(player.x,player.y-.7,player.z);this.group.rotation.set(0,yaw+Math.PI,0);for(const w of this.wings)w.wing.rotation.z=w.side*Math.sin(time*(moving?2.6:1.8))*.18;}
}
