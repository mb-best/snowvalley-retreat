import{MIN_X,MAX_X,MIN_Z,MAX_Z,clamp}from'./core.js';

// Geometry only: the map and camera both use these same metric coordinates.
export function mapPointer(event,rect,width=1200,height=960){
 const scale=Math.min(rect.width/width,rect.height/height),left=rect.left+(rect.width-width*scale)/2,top=rect.top+(rect.height-height*scale)/2;
 const x=(event.clientX-left)/scale,y=(event.clientY-top)/scale;
 return scale>0&&x>=0&&x<=width&&y>=0&&y<=height?{x,y,worldX:MIN_X+x/width*(MAX_X-MIN_X),worldZ:MIN_Z+y/height*(MAX_Z-MIN_Z)}:null;
}
export const coordinateText=(x,z)=>`X ${(x-MIN_X).toFixed(0)} m · Y ${(z-MIN_Z).toFixed(0)} m`;
export const speedText=s=>`${(Math.max(0,s)*3.6).toLocaleString('zh-CN',{maximumFractionDigits:1})} km/h`;

class Heap{
 constructor(){this.items=[];}
 push(v){const a=this.items;let i=a.length;a.push(v);while(i){const p=(i-1)>>1;if(a[p].f<=v.f)break;a[i]=a[p];i=p;}a[i]=v;}
 pop(){const a=this.items,v=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c;}a[i]=last;}return v;}
}

// Bounded, cooperative A*: the canvas remains responsive while a long route is
// planned. Every edge is sampled, including the final off-grid approach.
export async function groundRoute(start,target,{geo,blocked=()=>false,riding=false,yieldFrame=()=>new Promise(requestAnimationFrame),cancelled=()=>false,cell=80,maxNodes=42000}={}){
 const pointOK=p=>p[0]>MIN_X+2&&p[0]<MAX_X-2&&p[1]>MIN_Z+2&&p[1]<MAX_Z-2&&!blocked(...p)&&(!riding||!(geo.waterAt(...p)?.depth>.65));
 let goal=[clamp(target[0],MIN_X+3,MAX_X-3),clamp(target[1],MIN_Z+3,MAX_Z-3)];
 if(!pointOK(goal)){let nearest=null;for(let r=4;r<=120&&!nearest;r+=4)for(let i=0;i<24;i++){const a=i*Math.PI/12,p=[goal[0]+Math.cos(a)*r,goal[1]+Math.sin(a)*r];if(pointOK(p)){nearest=p;break;}}if(!nearest)return null;goal=nearest;}
 const cache=new Map(),height=p=>{const k=p.join(':');if(!cache.has(k))cache.set(k,geo.height(...p));return cache.get(k);};
 const edge=(a,b)=>{const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/10));let prev=a,old=height(a);for(let i=1;i<=n;i++){const p=[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n];if(!pointOK(p))return false;const h=height(p);if(Math.abs(h-old)>Math.hypot(p[0]-prev[0],p[1]-prev[1])*1.04+.12)return false;old=h;prev=p;}return true;};
 if(edge(start,goal))return{points:[start,goal],goal,adjusted:Math.hypot(goal[0]-target[0],goal[1]-target[1])>2};
 const origin=[start[0],start[1]],toWorld=(i,j)=>[origin[0]+i*cell,origin[1]+j*cell],key=(i,j)=>i+':'+j,heuristic=p=>Math.hypot(p[0]-goal[0],p[1]-goal[1]),open=new Heap(),nodes=new Map(),first={i:0,j:0,p:start,g:0};first.f=heuristic(start);nodes.set('0:0',first);open.push(first);let visited=0,finish=null;
 while(open.items.length&&visited<maxNodes){if(cancelled())return null;const current=open.pop();if(current.closed)continue;current.closed=true;visited++;
  if(heuristic(current.p)<cell*2&&edge(current.p,goal)){finish=current;break;}
  for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const i=current.i+di,j=current.j+dj,k=key(i,j),p=toWorld(i,j);if(!pointOK(p)||!edge(current.p,p))continue;const length=Math.hypot(di,dj)*cell,grade=(height(p)-height(current.p))/length,cost=length*(1+Math.abs(grade)*.5+(geo.waterAt(...p)?.depth>.65?1.5:0)),g=current.g+cost,old=nodes.get(k);if(old&&old.g<=g)continue;const node={i,j,p,g,f:g+heuristic(p),parent:current};nodes.set(k,node);open.push(node);}
  if(visited%160===0)await yieldFrame();
 }
 if(!finish)return null;const points=[goal];for(let n=finish;n;n=n.parent)points.push(n.p);points.reverse();
 // Remove grid corners only when the whole shortcut is traversable.
 const route=[points[0]];for(let i=0;i<points.length-1;){let j=Math.min(points.length-1,i+12);while(j>i+1&&!edge(points[i],points[j]))j--;route.push(points[j]);i=j;}
 return{points:route,goal,adjusted:Math.hypot(goal[0]-target[0],goal[1]-target[1])>2};
}

export class AutoTravel{
 constructor({geo,blocked,onStatus=()=>{},onFinish=()=>{}}){Object.assign(this,{geo,blocked,onStatus,onFinish});this.token=0;this.route=null;this.planning=false;}
 cancel(){this.token++;this.route=null;this.planning=false;}
 async begin(player,target,mode,name='地图标记点',attempt=0){
  this.cancel();const token=this.token;this.planning=true;this.onStatus('正在规划前往'+name+'的路线…');const start=[player.x,player.z],goal=[clamp(target[0],MIN_X+3,MAX_X-3),clamp(target[1],MIN_Z+3,MAX_Z-3)];
  const result=mode==='flight'?{points:[start,goal],goal}:await groundRoute(start,goal,{geo:this.geo,blocked:this.blocked,riding:mode==='horse',cancelled:()=>token!==this.token});
  if(token!==this.token)return false;this.planning=false;if(!result){this.onStatus('未找到可安全通行的路线；可以换一个落点或乘风飞行。');return false;}
  this.route={...result,index:1,mode,name,attempt,stalled:0};this.onStatus((result.adjusted?'落点已调整至附近可通行处。':'')+'自动前往'+name+' · 常速 · 手动移动 / Esc 取消');return true;
 }
 direction(player){const r=this.route;if(!r)return null;while(r.index<r.points.length&&Math.hypot(r.points[r.index][0]-player.x,r.points[r.index][1]-player.z)<1.2)r.index++;if(r.index>=r.points.length){this.cancel();this.onFinish();return null;}const p=r.points[r.index],dx=p[0]-player.x,dz=p[1]-player.z,distance=Math.hypot(dx,dz);return{x:dx/distance,z:dz/distance,distance};}
 track(distance,dt,player){const r=this.route;if(!r)return;r.stalled=distance<.001?r.stalled+dt:0;if(r.stalled>1){if(player&&r.attempt<3&&r.mode!=='flight'){void this.begin(player,r.goal,r.mode,r.name,r.attempt+1);}else{this.cancel();this.onStatus('前方未找到可通行的绕行路线，自动行进已暂停；可重新选点或乘风飞行。');}}}
}
