// The editable knots/handles are distinct from transient samples used for
// terrain checking and rendering in 3D. All design coordinates are kilometres.
export const hasCurve=f=>f.curve?.type==='cubic-bezier'&&Array.isArray(f.curve.segments)&&f.curve.segments.length===f.points.length-1;
const bound=p=>p.map((v,k)=>Math.max(0,Math.min(k?16:20,v)));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),lerp=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
export function cubicAt(a,c1,c2,b,t){let u=1-t;return[0,1].map(k=>a[k]===c1[k]&&a[k]===c2[k]&&a[k]===b[k]?a[k]:u*u*u*a[k]+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t*t*t*b[k]);}
export function cubicTangent(a,c1,c2,b,t){let u=1-t;return[0,1].map(k=>3*u*u*(c1[k]-a[k])+6*u*t*(c2[k]-c1[k])+3*t*t*(b[k]-c2[k]));}
export const curveSegment=(f,i)=>[f.points[i],...f.curve.segments[i],f.points[i+1]];
export function sampleCurve(f,step=.01){if(!hasCurve(f))return f.points;let out=[f.points[0]];for(let i=0;i<f.points.length-1;i++){let c=curveSegment(f,i),length=dist(c[0],c[1])+dist(c[1],c[2])+dist(c[2],c[3]),n=Math.max(2,Math.ceil(length/step));for(let j=1;j<=n;j++)out.push(j===n?c[3]:cubicAt(...c,j/n));}return out;}
export function curvePath(f,scale=100){let xy=p=>p.map(v=>(v*scale).toFixed(5)).join(' ');return'M'+xy(f.points[0])+f.curve.segments.map((s,i)=>' C'+xy(s[0])+' '+xy(s[1])+' '+xy(f.points[i+1])).join('');}
export function moveCurveKnot(f,i,next){let delta=next.map((v,k)=>v-f.points[i][k]);if(hasCurve(f)){if(i)f.curve.segments[i-1][1]=bound(f.curve.segments[i-1][1].map((v,k)=>v+delta[k]));if(i<f.points.length-1)f.curve.segments[i][0]=bound(f.curve.segments[i][0].map((v,k)=>v+delta[k]));}f.points[i]=next;}
export function splitCurve(f,i,t=.5){let[a,b,c,d]=curveSegment(f,i),ab=lerp(a,b,t),bc=lerp(b,c,t),cd=lerp(c,d,t),abc=lerp(ab,bc,t),bcd=lerp(bc,cd,t),p=lerp(abc,bcd,t);f.points.splice(i+1,0,p);f.curve.segments.splice(i,1,[ab,abc],[bcd,cd]);return i+1;}
export function removeCurveKnot(f,i){if(!hasCurve(f)){f.points.splice(i,1);return;}let ss=f.curve.segments;if(i===0)ss.shift();else if(i===f.points.length-1)ss.pop();else ss.splice(i-1,2,[ss[i-1][0],ss[i][1]]);f.points.splice(i,1);}
export function nearestCurve(f,p){let best={distance:Infinity,segment:0,t:.5};for(let i=0;i<f.points.length-1;i++){let c=curveSegment(f,i),n=Math.max(20,Math.ceil((dist(c[0],c[1])+dist(c[1],c[2])+dist(c[2],c[3]))/.005));for(let j=1;j<n;j++){let t=j/n,d=dist(p,cubicAt(...c,t));if(d<best.distance)best={distance:d,segment:i,t};}}return best;}
export function autoCurve(f){f.curve={type:'cubic-bezier',segments:f.points.slice(1).map((b,i)=>{let a=f.points[i],before=f.points[Math.max(0,i-1)],after=f.points[Math.min(f.points.length-1,i+2)];return[bound(a.map((v,k)=>v+(b[k]-before[k])/6)),bound(b.map((v,k)=>v-(after[k]-a[k])/6))];})};f.flowGeometry='cubic-bezier';return f;}

export function moveCurveHandle(f,segment,handle,next){
 const anchor=handle===0?segment:segment+1,p=f.points[anchor],other=handle===0?(segment?[segment-1,1]:null):(segment+1<f.curve.segments.length?[segment+1,0]:null);f.curve.segments[segment][handle]=bound(next);
 if(other){let old=f.curve.segments[other[0]][other[1]],length=dist(p,old),direction=subtract(next,p),r=Math.hypot(...direction);if(r>1e-9)f.curve.segments[other[0]][other[1]]=bound(p.map((v,k)=>v-direction[k]/r*length));}
}
const subtract=(a,b)=>a.map((v,k)=>v-b[k]);
// Include crossings and near-tangencies with 25 m raster boundaries. Uniform
// distance samples alone can miss a curve briefly entering a steep DEM cell.
export function curveAuditParameters(c,step=.0015){
 let length=dist(c[0],c[1])+dist(c[1],c[2])+dist(c[2],c[3]),n=Math.max(8,Math.ceil(length/step)),cuts=[0,1],out=[];
 for(let axis=0;axis<2;axis++){let[p0,p1,p2,p3]=c.map(p=>p[axis]),A=-p0+3*p1-3*p2+p3,B=3*p0-6*p1+3*p2,C=3*(p1-p0),D=p0,at=t=>((A*t+B)*t+C)*t+D,turns=[0,1];
  if(Math.abs(A)<1e-14){if(Math.abs(B)>1e-14){let t=-C/(2*B);if(t>0&&t<1)turns.push(t);}}
  else{let disc=4*B*B-12*A*C;if(disc>=0)for(let t of[(-2*B-Math.sqrt(disc))/(6*A),(-2*B+Math.sqrt(disc))/(6*A)])if(t>0&&t<1)turns.push(t);}
  turns.sort((a,b)=>a-b);for(let i=1;i<turns.length;i++){let a=turns[i-1],b=turns[i],av=at(a),bv=at(b);if(Math.abs(av-bv)<1e-13)continue;for(let k=Math.ceil(Math.min(av,bv)*40);k<=Math.floor(Math.max(av,bv)*40);k++){let target=k/40,lo=a,hi=b;for(let it=0;it<45;it++){let mid=(lo+hi)/2;if((at(mid)<target)===(av<bv))lo=mid;else hi=mid;}cuts.push((lo+hi)/2);}}
 }
 cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){let a=cuts[i-1],b=cuts[i],d=b-a;if(d<1e-12)continue;out.push(a+d*1e-6,(a+b)/2,b-d*1e-6);}for(let j=0;j<=n;j++)out.push(Math.max(1e-8,Math.min(1-1e-8,j/n)));return out.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-12);
}
