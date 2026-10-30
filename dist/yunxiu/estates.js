import * as T from'../vendor/three.module.js';
import{woodMaterial,stoneMaterial}from'../sunny/art-materials.js?v=2';
import{join}from'../sunny/plants.js?v=2';

// Designed gardens are confined to a lodge's own grounds. They are not restored
// wilderness trails and never enter the player-built road save collection.
export function buildEstate(scene,geo,houses,town,assets,colliders){
 const minX=Math.min(...houses.map(h=>h.x-h.width/2))-12,maxX=Math.max(...houses.map(h=>h.x+h.width/2))+12,minZ=Math.min(...houses.map(h=>h.z-h.depth/2))-12,maxZ=Math.max(...houses.map(h=>h.z+h.depth/2))+15,bounds=[minX,minZ,maxX,maxZ],gateX=(minX+maxX)/2,parts=[],posts=[];
 const box=(w,h,d,x,y,z,angle=0)=>{const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);parts.push(g);};
 for(const[a,b]of[[[minX,minZ],[maxX,minZ]],[[maxX,minZ],[maxX,maxZ]],[[maxX,maxZ],[minX,maxZ]],[[minX,maxZ],[minX,minZ]]]){
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/3.5);let prev=null;
  for(let i=0;i<=n;i++){const x=a[0]+(b[0]-a[0])*i/n,z=a[1]+(b[1]-a[1])*i/n,gate=z===maxZ&&Math.abs(x-gateX)<5;
   if(gate||geo.waterAt(x,z)){prev=null;continue;}const y=geo.height(x,z);box(.18,1.5,.18,x,y+.75,z);posts.push([x,y,z]);
   if(prev){const dx=x-prev[0],dz=z-prev[2],distance=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),mid=[(x+prev[0])/2,(y+prev[1])/2,(z+prev[2])/2];for(const h of[.57,1.17])box(.1,.14,distance,...[mid[0],mid[1]+h,mid[2]],angle);colliders.push({x:mid[0],z:mid[2],angle,hx:.12,hz:distance/2,y:Math.min(y,prev[1]),top:Math.max(y,prev[1])+1.4});}prev=[x,y,z];
  }
 }
 const root=new T.Group();root.name=town.name+' · 围合庭园';const fence=new T.Mesh(join(parts),woodMaterial('#8c7858'));fence.castShadow=true;fence.receiveShadow=true;root.add(fence);parts.forEach(p=>p.dispose());
 const groundMat=stoneMaterial();groundMat.color.set('#c3b89b');
 const paths=[];for(const h of houses){const entry=[h.x+Math.sin(h.angle)*(h.depth/2+4),h.z+Math.cos(h.angle)*(h.depth/2+4)],start=[gateX,maxZ-4],segments=30,p=[],ix=[];for(let i=0;i<=segments;i++){const t=i/segments,x=start[0]+(entry[0]-start[0])*t,z=start[1]+(entry[1]-start[1])*t,dx=entry[0]-start[0],dz=entry[1]-start[1],len=Math.hypot(dx,dz)||1;for(const side of[-1,1]){const xx=x+dz/len*1.35*side,zz=z-dx/len*1.35*side;p.push(xx,geo.height(xx,zz)+.035,zz);}if(i<segments){const k=i*2;ix.push(k,k+2,k+1,k+1,k+2,k+3);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();const m=new T.Mesh(g,groundMat);m.receiveShadow=true;root.add(m);paths.push({start,end:entry});}
 // A sheltered entrance, raised flower planters, fruit-shaped ornamental trees,
 // and benches establish a lived-in private garden rather than a map label.
 for(const side of[-1,1]){const x=gateX+side*5,z=maxZ,y=geo.height(x,z),pillar=new T.Mesh(new T.BoxGeometry(.8,2.0,.8),groundMat);pillar.position.set(x,y+1,z);root.add(pillar);}
 for(let i=0;i<6;i++){const x=minX+8+(maxX-minX-16)*(i%3)/2,z=minZ+7+Math.floor(i/3)*(maxZ-minZ-17),y=geo.height(x,z);if(geo.waterAt(x,z)||houses.some(h=>Math.hypot(x-h.x,z-h.z)<18))continue;const planter=new T.Mesh(new T.BoxGeometry(3.8,.55,1.6),groundMat);planter.position.set(x,y+.27,z);root.add(planter);for(let k=0;k<4;k++){const model=assets.models.get(k%2?'flower_redA':'flower_purpleB').scene.clone(true),size=new T.Box3().setFromObject(model).getSize(new T.Vector3());model.scale.setScalar(.7/size.y);model.position.set(x-1.35+k*.9,y+.5,z);root.add(model);}}
 for(const side of[-1,1]){const x=gateX+side*9,z=maxZ-10,y=geo.height(x,z);const bench=new T.Group();for(const [px,py,pz,w,h,d]of[[0,.65,0,3.1,.18,.7],[0,1.13,.32,3.1,.85,.13],[-1,.32,0,.16,.65,.55],[1,.32,0,.16,.65,.55]]){const m=new T.Mesh(new T.BoxGeometry(w,h,d),fence.material);m.position.set(px,py,pz);bench.add(m);}bench.position.set(x,y,z);root.add(bench);}
 scene.add(root);root.userData={kind:'lodge-estate',placeId:town.id,bounds,gate:[gateX,maxZ],largeBuildings:houses.length};return{root,townId:town.id,bounds,gate:[gateX,maxZ],buildings:houses.length,paths,fencePosts:posts.length};
}
