import * as T from'../vendor/three.module.js';
import{ROAD_MATERIALS,BRIDGE_MATERIALS}from'./earthworks.js';
export class GroundChanges{
 constructor(land){this.land=land;this.geo=land.geo;this.scene=land.scene;this.tiles=new Map();this.lastVersion=-1;this.roads=new T.Group();this.scene.add(this.roads);this.materials={};
  for(const[k,m]of Object.entries(ROAD_MATERIALS))this.materials[k]=new T.MeshStandardMaterial({color:m.color,roughness:k==='wood'?.9:1});
  this.roadGround=this.patchMaterial(2);this.makeHydro();
 }
 patchMaterial(mode){const m=this.land.terrainMat.clone(),hook=this.land.terrainMat.onBeforeCompile;m.onBeforeCompile=s=>{hook(s);s.uniforms.uSurfaceMode={value:mode};};m.customProgramCacheKey=()=> 'yunxiu-ground-patch-'+mode;return m;}
 makeHydro(){const p=[],ix=[],n=this.land.quality==='low'?5:10,step=100/n;for(const key of this.geo.hydrology?.tiles||[]){const[i,j]=key.split(':').map(Number),x=i*100-10000,z=j*100-8000,offset=p.length/3;this.land.tileData[j*200+i]=1;
   for(let b=0;b<=n;b++)for(let a=0;a<=n;a++)p.push(x+a*step,this.geo.height(x+a*step,z+b*step),z+b*step);
   for(let b=0;b<n;b++)for(let a=0;a<n;a++){const k=offset+b*(n+1)+a;ix.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2);}}
  if(p.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();const mesh=new T.Mesh(g,this.patchMaterial(1));mesh.receiveShadow=true;this.scene.add(mesh);this.hydroMesh=mesh;}this.land.tileTexture.needsUpdate=true;
 }
 refresh(){const e=this.geo.earthworks;if(!e||e.version===this.lastVersion)return;this.lastVersion=e.version;
  for(const key of e.dirty){let mesh=this.tiles.get(key);const[i,j]=key.split(':').map(Number),x=i*100-10000,z=j*100-8000;if(!mesh){const g=new T.PlaneGeometry(100,100,50,50);g.rotateX(-Math.PI/2);mesh=new T.Mesh(g,this.roadGround);mesh.position.set(x+50,0,z+50);mesh.receiveShadow=true;this.scene.add(mesh);this.tiles.set(key,mesh);}const p=mesh.geometry.attributes.position;for(let n=0;n<p.count;n++)p.setY(n,this.geo.height(mesh.position.x+p.getX(n),mesh.position.z+p.getZ(n)));p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();this.land.tileData[j*200+i]=2;}
  e.dirty.clear();this.land.tileTexture.needsUpdate=true;this.land.updateNearBounds(e.changeBounds);e.changeBounds=null;this.rebuildRoads();
 }
 rebuildRoads(){for(const c of[...this.roads.children]){this.roads.remove(c);c.geometry.dispose();}const buckets=new Map();
  const tri=(key,...points)=>{if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(...points.flat());};
  const quad=(key,a,b,c,d)=>{tri(key,a,b,c);tri(key,c,b,d);};
  for(const s of this.geo.earthworks.segments){const{a,b,record:r}=s,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.001)continue;const nx=-dz/length*r.width/2,nz=dx/length*r.width/2,key=s.bridge?'bridge-'+r.bridgeMaterial:r.material,y0=a[2]+.055,y1=b[2]+.055;
   quad(key,[a[0]+nx,y0,a[1]+nz],[a[0]-nx,y0,a[1]-nz],[b[0]+nx,y1,b[1]+nz],[b[0]-nx,y1,b[1]-nz]);
   if(s.bridge){for(const side of[-1,1]){const x0=a[0]+nx*side,z0=a[1]+nz*side,x1=b[0]+nx*side,z1=b[1]+nz*side;quad(key,[x0,y0,z0],[x0,y0-.3,z0],[x1,y1,z1],[x1,y1-.3,z1]);quad(key,[x0,y0+.9,z0],[x0,y0+.80,z0],[x1,y1+.9,z1],[x1,y1+.8,z1]);}if(s.order%5===0){const floor=this.geo.height(a[0],a[1]);for(const side of[-1,1]){const x=a[0]+nx*side*.8,z=a[1]+nz*side*.8;quad(key,[x-.09,y0,z],[x+.09,y0,z],[x-.09,floor,z],[x+.09,floor,z]);}}}
  }
  for(const[key,p]of buckets){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();const mat=this.materials[key]||(this.materials[key]=new T.MeshStandardMaterial({color:BRIDGE_MATERIALS[key.slice(7)].color,roughness:.91,side:T.DoubleSide}));mat.side=T.DoubleSide;const m=new T.Mesh(g,mat);m.receiveShadow=true;m.castShadow=key.startsWith('bridge-');this.roads.add(m);}
 }
}
