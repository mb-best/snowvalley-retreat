import{distanceSegment}from'./model.js?v=8';
import{distance,mix}from'./landscape-hydrology.js?v=1';
import{terrainGradient,hikingContext,trailSegmentAudit,trailStats,HIKING_RULES}from'./landscape-trails.js?v=2';
import{cubicAt,cubicTangent,curveSegment,sampleCurve,hasCurve,curveAuditParameters}from'./curves.js?v=2';
const unit=v=>{let r=Math.hypot(...v)||1;return v.map(x=>x/r);},sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1],add=(a,b,s=1)=>a.map((v,k)=>v+b[k]*s);
export function auditTrailCurve(ctx,f,step=.0015){
 let maxGrade=0,maxOrdinaryContourAngle=0,maxPassContourAngle=0;
 for(let i=0;i<f.curve.segments.length;i++){
  let c=curveSegment(f,i),length=distance(c[0],c[1])+distance(c[1],c[2])+distance(c[2],c[3]),times=curveAuditParameters(c,step),last=c[0];
  for(let j=0;j<times.length;j++){let t=times[j],p=cubicAt(...c,t),v=cubicTangent(...c,t),r=Math.hypot(...v),g=terrainGradient(ctx.field,p),slope=Math.hypot(...g),grade=r>1e-12?Math.abs(dot(g,v))/r:0,angle=slope>=HIKING_RULES.contourSlopeThreshold&&r>1e-12?Math.asin(Math.min(1,grade/slope))*180/Math.PI:0,isPass=ctx.passes.some(q=>distance(p,q)<HIKING_RULES.passRadiusKm);
   // At a raster-cell edge the surface normal is discontinuous. Use the exact
   // chord audit on both sides instead of an arbitrary one-sided vertex normal.
   let onGrid=p.some(x=>Math.abs(x*20-Math.round(x*20))<1e-8);
   if(!onGrid){maxGrade=Math.max(maxGrade,grade);if(isPass)maxPassContourAngle=Math.max(maxPassContourAngle,angle);else maxOrdinaryContourAngle=Math.max(maxOrdinaryContourAngle,angle);if(grade>.5+1e-8||angle>(isPass?60:45)+1e-5)return{valid:false,reason:'tangent',segment:i,t,maxGrade,maxOrdinaryContourAngle,maxPassContourAngle};}
   if(ctx.water[ctx.key(p)])return{valid:false,reason:'water',segment:i,maxGrade,maxOrdinaryContourAngle,maxPassContourAngle};
   if(j&&distance(last,p)>.00001){let a=trailSegmentAudit(ctx,last,p);maxGrade=Math.max(maxGrade,a.maxGrade);maxOrdinaryContourAngle=Math.max(maxOrdinaryContourAngle,a.maxOrdinaryAngle||0);maxPassContourAngle=Math.max(maxPassContourAngle,a.maxPassAngle||0);if(!a.valid)return{valid:false,reason:'chord-'+a.reason,segment:i,t,maxGrade,maxOrdinaryContourAngle,maxPassContourAngle};}last=p;
  }
 }
 return{valid:true,maxGrade,maxOrdinaryContourAngle,maxPassContourAngle};
}
function parameters(ps){let u=[0];for(let i=1;i<ps.length;i++)u.push(u.at(-1)+distance(ps[i],ps[i-1]));let total=u.at(-1)||1;return u.map(v=>v/total);}
function generate(ps,u,left,right){let a=ps[0],b=ps.at(-1),c00=0,c01=0,c11=0,x0=0,x1=0;for(let i=0;i<ps.length;i++){let t=u[i],s=1-t,b0=s**3,b1=3*s*s*t,b2=3*s*t*t,b3=t**3,A=left.map(v=>v*b1),B=right.map(v=>v*b2),tmp=ps[i].map((v,k)=>v-a[k]*(b0+b1)-b[k]*(b2+b3));c00+=dot(A,A);c01+=dot(A,B);c11+=dot(B,B);x0+=dot(A,tmp);x1+=dot(B,tmp);}let det=c00*c11-c01*c01,L=distance(a,b),alpha=(x0*c11-x1*c01)/det,beta=(c00*x1-c01*x0)/det;if(!Number.isFinite(alpha)||!Number.isFinite(beta)||alpha<L*.001||beta<L*.001||alpha>L*1.5||beta>L*1.5)alpha=beta=L/3;return[a,add(a,left,alpha),add(b,right,beta),b];}
function fitChunk(ctx,ps,tolerance=.004){
 function acceptable(c,ps){if(c.some(p=>p[0]<0||p[0]>20||p[1]<0||p[1]>16))return false;for(let j=1;j<12;j++){let p=cubicAt(...c,j/12);if(Math.min(...ps.slice(1).map((b,i)=>distanceSegment(p,ps[i],b)))>.012)return false;}return auditTrailCurve(ctx,{points:[c[0],c[3]],curve:{segments:[[c[1],c[2]]]}}).valid;}
 function recurse(ps,left,right){
  if(ps.length===2){let a=ps[0],b=ps[1],c=[a,add(a,left,distance(a,b)/3),add(b,right,distance(a,b)/3),b];return[acceptable(c,ps)?c:[a,mix(a,b,1/3),mix(a,b,2/3),b]];}
  let u=parameters(ps),c=generate(ps,u,left,right),error=0,split=Math.floor(ps.length/2);for(let i=1;i<ps.length-1;i++){let e=distance(cubicAt(...c,u[i]),ps[i]);if(e>error){error=e;split=i;}}
  if(error<=tolerance&&acceptable(c,ps))return[c];let a=ps[0],b=ps.at(-1),line=[a,mix(a,b,1/3),mix(a,b,2/3),b];if(ps.every(p=>distanceSegment(p,a,b)<=tolerance)&&acceptable(line,ps))return[line];if(error<=tolerance)split=Math.floor(ps.length/2);let tangent=unit(sub(ps[Math.max(0,split-1)],ps[Math.min(ps.length-1,split+1)]));return[...recurse(ps.slice(0,split+1),left,tangent),...recurse(ps.slice(split),tangent.map(v=>-v),right)];
 }
 return recurse(ps,unit(sub(ps[1],ps[0])),unit(sub(ps.at(-2),ps.at(-1))));
}
export function convertTrailCurves(doc,field,{reference=null}={}){
 if(doc.trailCurveVersion>=1)return false;
 const ctx=hikingContext(doc,field),trails=doc.features.filter(f=>f.type==='trail'&&!hasCurve(f)),key=p=>p.map(v=>v.toFixed(7)).join(','),degree=new Map(),anchors=new Set((doc.trailNetwork?.targets||[]).map(t=>key(t.point)));let beforeNodes=0,afterNodes=0;
 for(let f of trails){beforeNodes+=f.points.length;for(let i=1;i<f.points.length;i++)for(let p of[f.points[i-1],f.points[i]])degree.set(key(p),(degree.get(key(p))||0)+1);let old=reference?.features.find(q=>q.id===f.id);if(old&&old.points.length===f.points.length)f.points.forEach((p,i)=>{if(distance(p,old.points[i])>1e-8)anchors.add(key(p));});}
 for(let[k,v]of degree)if(v!==2)anchors.add(k);
 for(let f of trails){let ps=f.points,cs=[],start=0;for(let i=1;i<ps.length;i++)if(i===ps.length-1||anchors.has(key(ps[i]))){cs.push(...fitChunk(ctx,ps.slice(start,i+1)));start=i;}f.points=[cs[0][0],...cs.map(c=>c[3])];f.curve={type:'cubic-bezier',segments:cs.map(c=>[c[1],c[2]])};f.flowGeometry='cubic-bezier';let audit=auditTrailCurve(ctx,f);if(!audit.valid)throw Error('曲线地形检查未通过：'+f.name+' '+JSON.stringify(audit));f.stats={...trailStats(field,sampleCurve(f,.005)),...audit};delete f.stats.valid;afterNodes+=f.points.length;}
 doc.trailCurveVersion=1;doc.revision++;doc.updatedAt=new Date().toISOString();if(doc.trailNetwork){doc.trailNetwork={...doc.trailNetwork,curveVersion:1,lengthKm:doc.features.filter(f=>f.type==='trail').reduce((s,f)=>s+(f.stats?.lengthKm||0),0),editableKnots:afterNodes,previousSampleNodes:beforeNodes,geometry:'cubic-bezier; editable knots and handles, transient internal sampling'};if(doc.landscapeDesign?.trails)doc.landscapeDesign.trails.lengthKm=doc.trailNetwork.lengthKm;}doc.notes+=' 步道曲线编辑修订：编辑点与内部高程采样分离，使用三次贝塞尔曲线、少量通过点和方向手柄；保留支路交点和功能入口，二维、三维及世界导出共用曲线。';return{beforeNodes,afterNodes,lengthKm:doc.trailNetwork?.lengthKm};
}
