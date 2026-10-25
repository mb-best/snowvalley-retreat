import * as THREE from '../vendor/three.module.js';
import{elevationAt,colors}from'./model.js?v=4';
const stops=[[1800,'#7f9f7a'],[2800,'#8fa77d'],[3500,'#a3b88a'],[4200,'#b8ba91'],[4800,'#aaa992'],[5300,'#c4c9b9'],[6100,'#eef0e5'],[9000,'#f6f6ee']];
const tint=h=>{let i=stops.findIndex(p=>p[0]>=h);if(i<=0)return new THREE.Color(stops[0][1]);let a=stops[i-1],b=stops[i];return new THREE.Color(a[1]).lerp(new THREE.Color(b[1]),(h-a[0])/(b[0]-a[0]));};
export class TerrainPreview{
 constructor(container,field,features,scale=1){
  this.container=container;this.field=field;this.scale=scale;this.theta=.55;this.phi=.86;this.radius=24;this.disposables=[];
  this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setClearColor('#dfe7d8');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;container.replaceChildren(this.renderer.domElement);
  this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog('#dfe7d8',40,85);this.scene.add(new THREE.HemisphereLight('#f8f9ee','#9fa88b',2.2));let sun=new THREE.DirectionalLight('#fff7da',2.3);sun.position.set(-15,25,-14);this.scene.add(sun);
  this.camera=new THREE.PerspectiveCamera(42,1,.1,150);this.terrain=new THREE.Group();this.scene.add(this.terrain);
  let positions=[],vertexColors=[],indices=[],{nx,ny,values}=field;
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let h=values[j*nx+i];positions.push(i/(nx-1)*20-10,(h-1700)/1000,j/(ny-1)*16-8);let c=tint(h);vertexColors.push(c.r,c.g,c.b);}
  for(let j=0;j<ny-1;j++)for(let i=0;i<nx-1;i++){let k=j*nx+i;indices.push(k,k+nx,k+1,k+1,k+nx,k+nx+1);}
  let geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geom.setAttribute('color',new THREE.Float32BufferAttribute(vertexColors,3));geom.setIndex(indices);geom.computeVertexNormals();this.addMesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  // Exposed cut sides make the footprint and the vertical scale legible.
  let rim=[];for(let i=0;i<nx;i++)rim.push(i);for(let j=1;j<ny;j++)rim.push(j*nx+nx-1);for(let i=nx-2;i>=0;i--)rim.push((ny-1)*nx+i);for(let j=ny-2;j>0;j--)rim.push(j*nx);
  let sides=[];for(let i=0;i<rim.length;i++){let a=rim[i]*3,b=rim[(i+1)%rim.length]*3;sides.push(positions[a],positions[a+1],positions[a+2],positions[b],positions[b+1],positions[b+2],positions[a],-.12,positions[a+2],positions[b],positions[b+1],positions[b+2],positions[b],-.12,positions[b+2],positions[a],-.12,positions[a+2]);}
  let sideGeom=new THREE.BufferGeometry();sideGeom.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));sideGeom.computeVertexNormals();this.addMesh(sideGeom,new THREE.MeshStandardMaterial({color:'#b5b698',roughness:1,side:THREE.DoubleSide}));
  for(let f of features){if(f.type==='lake'){let shape=new THREE.Shape(f.points.map(p=>new THREE.Vector2(p[0]-10,-(p[1]-8))));let g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,(f.elevation-1700)/1000+.018,0);this.addMesh(g,new THREE.MeshStandardMaterial({color:'#78b1bd',roughness:.35,metalness:.08,side:THREE.DoubleSide}));}
   else if(['river','trail','forest','grassland','meadow','ridge'].includes(f.type)){let ps=[];for(let i=0;i<f.points.length-(f.closed?0:1);i++){let a=f.points[i],b=f.points[(i+1)%f.points.length],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.05);for(let j=0;j<n;j++){let x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n;ps.push(new THREE.Vector3(x-10,(elevationAt(field,x,y)-1700)/1000+.024,y-8));}}if(!f.closed){let p=f.points.at(-1);ps.push(new THREE.Vector3(p[0]-10,(elevationAt(field,...p)-1700)/1000+.024,p[1]-8));}if(ps.length>1){let g=new THREE.BufferGeometry().setFromPoints(ps),m=new THREE.LineBasicMaterial({color:colors[f.type],transparent:true,opacity:f.type==='river'?.95:.5});this.terrain.add(new THREE.Line(g,m));this.disposables.push(g,m);}}
  }
  let floor=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#dbe3d0',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.18;this.scene.add(floor);this.disposables.push(floor.geometry,floor.material);
  let grid=new THREE.GridHelper(20,10,'#a0b28d','#c4d0b7');grid.position.y=-.16;this.scene.add(grid);this.disposables.push(grid.geometry,grid.material);
  this.onDown=e=>{this.pointer=[e.clientX,e.clientY];this.renderer.domElement.setPointerCapture(e.pointerId);};this.onMove=e=>{if(!this.pointer)return;this.theta-=(e.clientX-this.pointer[0])*.007;this.phi=Math.max(.18,Math.min(1.5,this.phi+(e.clientY-this.pointer[1])*.006));this.pointer=[e.clientX,e.clientY];this.draw();};this.onUp=()=>this.pointer=null;this.onWheel=e=>{e.preventDefault();this.radius=Math.max(10,Math.min(50,this.radius*(e.deltaY>0?1.08:.92)));this.draw();};
  for(let[event,fn]of[['pointerdown',this.onDown],['pointermove',this.onMove],['pointerup',this.onUp],['pointercancel',this.onUp],['wheel',this.onWheel]])this.renderer.domElement.addEventListener(event,fn,{passive:event!=='wheel'});
  this.resize=new ResizeObserver(()=>{let w=container.clientWidth,h=container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.draw();});this.resize.observe(container);this.setScale(scale);
 }
 addMesh(g,m){this.terrain.add(new THREE.Mesh(g,m));this.disposables.push(g,m);}
 setScale(s){this.scale=s;this.terrain.scale.y=s;this.draw();}
 draw(){let target=new THREE.Vector3(0,1.6*this.scale,0);this.camera.position.set(Math.sin(this.theta)*Math.sin(this.phi)*this.radius,target.y+Math.cos(this.phi)*this.radius,Math.cos(this.theta)*Math.sin(this.phi)*this.radius);this.camera.lookAt(target);this.renderer.render(this.scene,this.camera);}
 dispose(){this.resize.disconnect();for(let d of this.disposables)d.dispose();this.renderer.dispose();this.renderer.domElement.remove();}
}
