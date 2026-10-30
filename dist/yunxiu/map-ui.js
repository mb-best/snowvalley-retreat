import{worldPoint,clamp}from'./core.js';
import{mapPointer,coordinateText}from'./navigation.js?v=travel-1';

export class WorldMapUI{
 constructor({geo,player,baseMap,drawRoads,drawArrow,getYaw,getRoute,onNavigate,onTeleport,onOpen,onRange,range=600}){
  Object.assign(this,{geo,player,baseMap,drawRoads,drawArrow,getYaw,getRoute,onNavigate,onTeleport,onOpen,onRange});this.range=clamp(range,100,10000);this.hits=[];this.hovered=null;this.selected=null;
  this.$=id=>document.getElementById(id);this.places=geo.features.filter(f=>f.name&&!['contour','trail'].includes(f.type)).map(f=>({id:f.id,name:f.name,type:f.type,hidden:!!f.hideLabel,point:worldPoint(f.accessPoint||f.points.reduce((a,p)=>[a[0]+p[0]/f.points.length,a[1]+p[1]/f.points.length],[0,0]))}));
  for(const p of this.places){const o=document.createElement('option');o.value=p.id;o.textContent=p.name;this.$('atlasPlace').append(o);}
  this.$('atlasPlace').onchange=()=>{this.selected=this.places.find(p=>p.id===this.$('atlasPlace').value);if(this.selected)this.showInfo(this.selected.point,this.selected);this.drawAtlas();};
  this.$('navigatePlace').onclick=()=>{const p=this.places.find(p=>p.id===this.$('atlasPlace').value);if(p)this.navigate(p.point,p);};
  const canvas=this.$('atlas');
  canvas.addEventListener('pointermove',e=>{const p=mapPointer(e,canvas.getBoundingClientRect()),hit=p&&this.hit(p);if(hit!==this.hovered){this.hovered=hit;canvas.style.cursor=p?'pointer':'default';this.drawAtlas();}this.$('atlasReadout').textContent=p?coordinateText(p.worldX,p.worldZ)+(hit?' · '+hit.place.name:' · 点击自动前往'):'X 向东 · Y 向南 · 西北角为原点';});
  canvas.addEventListener('pointerleave',()=>{this.hovered=null;this.drawAtlas();});
  canvas.addEventListener('click',e=>{const p=mapPointer(e,canvas.getBoundingClientRect());if(!p)return;const hit=this.hit(p);this.showInfo(hit?hit.place.point:[p.worldX,p.worldZ],hit?.place);this.$('mapActions').hidden=true;this.drawAtlas();});
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();const p=mapPointer(e,canvas.getBoundingClientRect());if(!p)return;const hit=this.hit(p),point=hit?hit.place.point:[p.worldX,p.worldZ];this.showInfo(point,hit?.place);this.$('mapActions').hidden=false;this.drawAtlas();});
  this.$('mapGuide').onclick=()=>{if(this.inspected)this.navigate(this.inspected.point,this.inspected.place);};this.$('mapTeleport').onclick=()=>{if(this.inspected)this.onTeleport(this.inspected.point,this.inspected.place?.name);};
  this.$('showMapActions').onclick=()=>{if(this.inspected)this.$('mapActions').hidden=false;};
  const mini=this.$('miniMap');mini.addEventListener('click',()=>this.onOpen());
  mini.addEventListener('wheel',e=>{e.preventDefault();this.setRange(this.range*(e.deltaY>0?1.25:.8));},{passive:false});
  for(const[id,multiplier]of[['zoomIn',1/1.5],['zoomOut',1.5]])this.$(id).onclick=e=>{e?.stopPropagation();this.setRange(this.range*multiplier);};
  // Pinch to zoom; suppress the click generated at the end of a pinch.
  const pointers=new Map();let pinch=null,suppressClick=false;
  this.$('radar').addEventListener('pointerdown',e=>{pointers.set(e.pointerId,[e.clientX,e.clientY]);this.$('radar').setPointerCapture(e.pointerId);if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a[0]-b[0],a[1]-b[1]),range:this.range};suppressClick=true;}});
  this.$('radar').addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pinch&&pointers.size===2){const[a,b]=[...pointers.values()];this.setRange(pinch.range*pinch.distance/Math.max(1,Math.hypot(a[0]-b[0],a[1]-b[1])));}});
  for(const name of['pointerup','pointercancel'])this.$('radar').addEventListener(name,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;});
  this.$('radar').addEventListener('click',e=>{if(suppressClick){e.stopPropagation();suppressClick=false;}});
 }
 showInfo(point,place){this.inspected={point,place};this.selected=place||null;if(place)this.$('atlasPlace').value=place.id;const[x,z]=point,e=this.geo.ecological(x,z),water=this.geo.waterAt(x,z);this.$('mapPlaceInfo').hidden=false;this.$('mapPlaceName').textContent=place?.name||'地图选定点';this.$('mapPlaceCoordinates').textContent=coordinateText(x,z);this.$('mapPlaceAltitude').textContent='地面'+(water?'／水底':'')+'海拔 '+(this.geo.height(x,z)+1700).toFixed(1)+' m'+(water?' · 水面 '+(water.height+1700).toFixed(1)+' m':'');this.$('mapPlaceBiome').textContent='所在地貌：'+(water?(water.kind==='lake'?'湖泊':water.kind==='fall'?'瀑布':'河流')+' · ':'')+e.band;}
 navigate(point,place){this.selected=place||null;if(place)this.$('atlasPlace').value=place.id;this.onNavigate(point,place?.name);}
 hit(p){return[...this.hits].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h)||null;}
 setRange(value){this.range=clamp(Math.round(value),100,10000);this.$('zoomIn').disabled=this.range<=100;this.$('zoomOut').disabled=this.range>=10000;this.onRange(this.range);this.drawRadar();}
 route(ctx,project){const r=this.getRoute();if(!r)return;ctx.save();ctx.strokeStyle='#af6b38';ctx.lineWidth=2.7;ctx.setLineDash([7,5]);ctx.beginPath();ctx.moveTo(...project([this.player.x,this.player.z]));for(const p of r.points.slice(r.index))ctx.lineTo(...project(p));ctx.stroke();ctx.setLineDash([]);const[x,y]=project(r.goal);ctx.strokeStyle='#a75b37';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();ctx.restore();}
 drawAtlas(){
  const c=this.$('atlas'),ctx=c.getContext('2d'),w=c.width,h=c.height,project=p=>[(p[0]+10000)/20000*w,(p[1]+8000)/16000*h];ctx.clearRect(0,0,w,h);ctx.drawImage(this.baseMap,0,0,w,h);this.drawRoads(ctx,project,w/20000);this.route(ctx,project);this.hits=[];
  const occupied=[],hoverId=this.hovered?.place.id,labels=[],points=this.places.filter(p=>!p.hidden||p.id===this.selected?.id).sort((a,b)=>(a.type==='village'?0:a.type==='peak'?1:2)-(b.type==='village'?0:b.type==='peak'?1:2));
  for(const p of points){const[x,y]=project(p.point),size=p.type==='village'?16:12;ctx.font=size+'px serif';const textWidth=ctx.measureText(p.name).width+8,textHeight=size+6;
   let left=x-textWidth/2,top=y-size-12;const offsets=[[0,-12],[0,18],[30,0],[-30,0],[0,-32],[0,37],[50,-23],[-50,-23],[60,26],[-60,26]];
   for(const[dx,dy]of offsets){const l=clamp(x+dx-textWidth/2,2,w-textWidth-2),t=clamp(y+dy-textHeight,2,h-textHeight-2);left=l;top=t;if(!occupied.some(q=>l<q.x+q.w&&l+textWidth>q.x&&t<q.y+q.h&&t+textHeight>q.y))break;}
   const label={x:left,y:top,w:textWidth,h:textHeight,place:p,mx:x,my:y,size};occupied.push(label);this.hits.push(label);labels.push(label);
   ctx.fillStyle=p.type==='village'?'#906b46':p.type==='peak'?'#697162':'#5c7e6c';ctx.beginPath();ctx.arc(x,y,p.type==='village'?4:2.5,0,Math.PI*2);ctx.fill();
  }
  const paint=(l,active)=>{const x=l.x+l.w/2,y=l.y+l.h-4;ctx.save();ctx.font=(active?'bold ':'')+(active?l.size*1.24:l.size)+'px serif';ctx.textAlign='center';ctx.strokeStyle=active?'#fff8d9':'#eef0d9';ctx.lineWidth=active?5:3;ctx.lineJoin='round';ctx.strokeText(l.place.name,x,y);ctx.fillStyle=active?'#805124':'#405a49';ctx.fillText(l.place.name,x,y);if(active){ctx.strokeStyle='#a97840';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(l.mx,l.my);ctx.lineTo(x,y);ctx.stroke();}ctx.restore();};
  for(const l of labels)if(l.place.id!==hoverId&&l.place.id!==this.selected?.id)paint(l,false);for(const l of labels)if(l.place.id===hoverId||l.place.id===this.selected?.id)paint(l,true);
  this.hovered=this.hits.find(l=>l.place.id===hoverId)||null;const[x,y]=project([this.player.x,this.player.z]);this.drawArrow(ctx,x,y,12);
 }
 drawRadar(){
  const c=this.$('radar'),ctx=c.getContext('2d'),range=this.range,project=p=>[(p[0]-this.player.x+range)/(range*2)*c.width,(p[1]-this.player.z+range*.8)/(range*1.6)*c.height],sx=(this.player.x+10000-range)/20000*this.baseMap.width,sy=(this.player.z+8000-range*.8)/16000*this.baseMap.height,sw=range*2/20000*this.baseMap.width,sh=range*1.6/16000*this.baseMap.height;
  ctx.fillStyle='#c8d3b4';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(this.baseMap,sx,sy,sw,sh,0,0,c.width,c.height);this.drawRoads(ctx,project,c.width/(range*2));this.route(ctx,project);
  for(const t of this.geo.settlements){const[x,y]=project(t.point);if(x<0||x>c.width||y<0||y>c.height)continue;ctx.fillStyle='#a68159';ctx.fillRect(x-4,y-3,8,6);}this.drawArrow(ctx,c.width/2,c.height/2,9);
  const degrees=((this.getYaw()*180/Math.PI)%360+360)%360;this.$('compassText').textContent=['北','西北','西','西南','南','东南','东','东北'][Math.round(degrees/45)%8]+' · 宽 '+(range*2/1000).toFixed(2)+' km';this.$('mapCoordinates').textContent=coordinateText(this.player.x,this.player.z);
 }
}
