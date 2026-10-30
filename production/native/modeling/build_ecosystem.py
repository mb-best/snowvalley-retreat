"""Author metre-scale modular alpine samples and portable, editable GLBs.
Custom geometry/material colours, no external copyrighted model inputs.
This creates asset studies, not a finished art-approved or playable world.
"""
import argparse
import hashlib
import json
import math
import os
import struct
from pathlib import Path
import numpy as np

MATERIALS = {
 'bark':([.19,.105,.052],.93), 'wood':([.34,.17,.075],.85),
 'wood_dark':([.13,.066,.031],.9), 'plaster':([.76,.71,.58],.94),
 'stone':([.36,.38,.35],.95), 'slate':([.16,.22,.24],.86),
 'glass':([.13,.29,.34],.22), 'needle':([.045,.16,.073],.88),
 'needle_light':([.11,.24,.08],.9), 'grass':([.17,.31,.075],.94),
 'grass_light':([.32,.41,.105],.94), 'petal_white':([.87,.84,.71],.85),
 'petal_blue':([.21,.23,.55],.85), 'pollen':([.68,.36,.035],.9),
 'soil':([.14,.095,.054],1), 'metal':([.065,.072,.07],.65),
}

class Asset:
 def __init__(self,name): self.name=name; self.parts=[]
 def part(self,name,material):
  p={'name':name,'material':material,'v':[],'n':[],'f':[]}; self.parts.append(p); return p
 def tri(self,p,a,b,c):
  a,b,c=map(lambda x:np.asarray(x,float),(a,b,c)); normal=np.cross(b-a,c-a);length=np.linalg.norm(normal)
  if length<1e-11:return
  normal/=length;k=len(p['v']);p['v'].extend((a.tolist(),b.tolist(),c.tolist()));p['n'].extend([normal.tolist()]*3);p['f'].append([k,k+1,k+2])
 def quad(self,p,a,b,c,d): self.tri(p,a,b,c);self.tri(p,a,c,d)
 def box(self,p,center,size,rot=0):
  x,y,z=np.asarray(size)/2
  vs=np.array([[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]])
  co,si=np.cos(rot),np.sin(rot);vs=vs@np.array([[co,si,0],[-si,co,0],[0,0,1]])+center
  for ids in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:self.quad(p,*vs[list(ids)])
 def tube(self,p,points,radii,sides=7):
  pts=np.asarray(points,float); rings=[]
  for j,point in enumerate(pts):
   axis=pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)];axis/=np.linalg.norm(axis)
   ref=np.array([0,0,1.]) if abs(axis[2])<.9 else np.array([1.,0,0])
   u=np.cross(axis,ref);u/=np.linalg.norm(u);v=np.cross(axis,u)
   rings.append([point+radii[j]*(u*np.cos(k*2*np.pi/sides)+v*np.sin(k*2*np.pi/sides)) for k in range(sides)])
  for i in range(len(rings)-1):
   for k in range(sides):self.quad(p,rings[i][k],rings[i][(k+1)%sides],rings[i+1][(k+1)%sides],rings[i+1][k])
  for k in range(sides):
   self.tri(p,pts[0],rings[0][(k+1)%sides],rings[0][k]);self.tri(p,pts[-1],rings[-1][k],rings[-1][(k+1)%sides])
 def save(self,path):
  blob=bytearray();doc={'asset':{'version':'2.0','generator':'Yunxiu authored ecosystem study v01'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'buffers':[],'bufferViews':[],'accessors':[],'extras':{'units':'metres','upAxis':'glTF Y-up','source':'custom procedural geometry; no external mesh inputs','artStatus':'review sample; not final art approval'}}
  matids={}
  for name,(color,rough) in MATERIALS.items():
   matids[name]=len(doc['materials']);doc['materials'].append({'name':name,'doubleSided':name.startswith(('needle','grass','petal')),'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'metallicFactor':0,'roughnessFactor':rough}})
  def attr(a,ctype,kind):
   while len(blob)%4:blob.append(0)
   raw=a.tobytes();view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw)});blob.extend(raw)
   index=len(doc['accessors']);entry={'bufferView':view,'componentType':ctype,'count':len(a),'type':kind}
   if kind=='VEC3':entry.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
   doc['accessors'].append(entry);return index
  for part in self.parts:
   if not part['v']:continue
   # Right-handed Blender Z-up -> glTF Y-up: X, Z, -Y.
   v=np.array(part['v'],np.float32)[:,[0,2,1]]*np.array([1,1,-1],np.float32)
   n=np.array(part['n'],np.float32)[:,[0,2,1]]*np.array([1,1,-1],np.float32)
   f=np.array(part['f'],np.uint32).ravel()
   pa=attr(v.astype('<f4'),5126,'VEC3');na=attr(n.astype('<f4'),5126,'VEC3');ia=attr(f.astype('<u4'),5125,'SCALAR')
   index=len(doc['meshes']);doc['meshes'].append({'name':part['name'],'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':matids[part['material']]}]})
   doc['scenes'][0]['nodes'].append(len(doc['nodes']));doc['nodes'].append({'name':part['name'],'mesh':index})
  doc['buffers']=[{'byteLength':len(blob)}];raw=json.dumps(doc,separators=(',',':')).encode();raw+=b' '*((-len(raw))%4);blob.extend(b'\0'*((-len(blob))%4))
  path.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(raw)+len(blob))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
  vertices=np.concatenate([np.asarray(p['v']) for p in self.parts if p['v']]);extent=vertices.max(0)-vertices.min(0)
  return {'id':self.name,'file':path.name,'triangles':sum(len(p['f']) for p in self.parts),'parts':len(doc['meshes']),'dimensionsMetresXYZ':extent.tolist(),'boundsMinZUp':vertices.min(0).tolist(),'boundsMaxZUp':vertices.max(0).tolist(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'license':'project-authored procedural geometry; no third-party mesh input','artAccepted':False}


def spruce(seed=1597):
 a=Asset('alpine-spruce-structure-v01');rng=np.random.default_rng(seed)
 trunk=a.part('Trunk_roots_and_branches','bark');needles=[a.part('Needles_deep','needle'),a.part('Needles_sunlit','needle_light')]
 height=10.8;points=[[.035*np.sin(j*.8),.03*np.sin(j*1.2),height*j/14] for j in range(15)]
 a.tube(trunk,points,[.20*(1-j/15)**1.15+.012 for j in range(15)],11)
 for j in range(7):
  t=j*2.39996;d=np.array([np.cos(t),np.sin(t),0]);a.tube(trunk,[d*.08+[0,0,.3],d*.5+[0,0,.1],d*.95+[0,0,.025]],[.13,.075,.005],7)
 for layer in range(14):
  z=1.4+layer*.61;spread=2.35*(1-z/height)**.65;phase=rng.uniform(0,2*np.pi)
  for branch in range(6):
   angle=phase+branch*np.pi/3+rng.uniform(-.16,.16);d=np.array([np.cos(angle),np.sin(angle),0]);side=np.array([-d[1],d[0],0])
   length=spread*rng.uniform(.8,1.12);root=np.array([0,0,z]);end=root+d*length+[0,0,-.22+layer*.026]
   a.tube(trunk,[root,root+d*length*.5+[0,0,-.18],end],[.036*(1-layer/18),.015,.002],6)
   for twig in range(1,8):
    along=twig/8;attach=root*(1-along)+end*along
    for sign in (-1,1):
     tip=attach+(d*.24+sign*side*.46)*length*(1-along*.8)+[0,0,.09]
     a.tube(trunk,[attach,tip],[.008,.0015],5)
     axis=tip-attach
     for spray in range(6):
      center=attach+axis*(spray+.4)/6
      for finger in range(5):
       theta=finger*2.39996+spray*.8;radial=side*np.cos(theta)+np.array([0,0,1])*np.sin(theta)
       # Small pointed sprays leave negative space between layered branches.
       leaf_end=center+radial*.075+d*.035
       width=np.cross(axis,radial);width/=max(np.linalg.norm(width),1e-8);width*=.013
       p=needles[1 if rng.random()<.23 else 0]
       a.tri(p,center-width,center+width,leaf_end)
 return a


def meadow(seed=1597):
 a=Asset('alpine-meadow-clump-v01');rng=np.random.default_rng(seed)
 grass=[a.part('Fine_grass_dark','grass'),a.part('Fine_grass_light','grass_light')]
 stems=a.part('Flower_stems','grass');petals=[a.part('Ivory_flower_petals','petal_white'),a.part('Blue_flower_petals','petal_blue')];pollen=a.part('Flower_centres','pollen')
 for i in range(165):
  angle=rng.uniform(0,2*np.pi);r=np.sqrt(rng.random())*.42;root=np.array([np.cos(angle)*r,np.sin(angle)*r,0])
  h=rng.uniform(.16,.52)*(1-.35*r/.42);bend=np.array([rng.uniform(-.15,.15),rng.uniform(-.15,.15),0]);width=rng.uniform(.004,.011);side=np.array([np.cos(angle),np.sin(angle),0])*width
  mid=root+bend*.3+[0,0,h*.58];tip=root+bend+[0,0,h]
  p=grass[i%2];a.quad(p,root-side,root+side,mid+side*.65,mid-side*.65);a.tri(p,mid-side*.65,mid+side*.65,tip)
 for i in range(15):
  r=np.sqrt(rng.random())*.35;t=rng.uniform(0,2*np.pi);root=np.array([np.cos(t)*r,np.sin(t)*r,0]);head=root+[rng.uniform(-.05,.05),rng.uniform(-.05,.05),rng.uniform(.23,.48)]
  a.tube(stems,[root,(root+head)/2,head],[.0028,.002,.0012],5)
  for j in range(5 if i%2 else 7):
   theta=j*2*np.pi/(5 if i%2 else 7);d=np.array([np.cos(theta),np.sin(theta),0]);side=np.array([-d[1],d[0],0]);mid=head+d*.020+[0,0,.004];tip=head+d*.036+[0,0,.006]
   a.quad(petals[i%2],head,mid+side*.010,tip,mid-side*.010)
  a.tube(pollen,[head,head+[0,0,.006]],[.007,.004],7)
 return a


def chalet(seed=1597):
 a=Asset('swiss-timber-stone-house-v01');rng=np.random.default_rng(seed)
 stone=a.part('Foundation_individual_stones','stone');plaster=a.part('Plaster_wall_panels','plaster');wood=a.part('Timber_frame_balcony_shutters','wood');dark=a.part('Dark_reveals_and_floor','wood_dark');slate=a.part('Roof_individual_shingles','slate');glass=a.part('Recessed_glazing','glass');metal=a.part('Door_handle_and_hinges','metal')
 # Footprint 8 x 6m; foundation is real masonry pieces, not a facade plane.
 for row in range(3):
  for side in (-1,1):
   for j in range(16):a.box(stone,[-3.75+j*.5+(row%2)*.12,side*2.92,.12+row*.23],[.46,.28,.20],rng.uniform(-.025,.025))
   for j in range(11):a.box(stone,[side*3.92,-2.65+j*.52,.12+row*.23],[.26,.48,.20],rng.uniform(-.025,.025))
 a.box(dark,[0,0,.63],[8,6,.18]);a.box(dark,[0,0,3.35],[8,6,.22])
 # Front wall grid with actual door/window apertures.
 xs=[-4,-3,-1.7,-.58,.58,1.7,3,4];zs=[.72,1.30,2.42,2.82,3.28]
 openings=[(-.58,.58,.72,2.82),(-3,-1.7,1.30,2.42),(1.7,3,1.30,2.42)]
 for l,r in zip(xs,xs[1:]):
  for lo,hi in zip(zs,zs[1:]):
   if any(l>=x0 and r<=x1 and lo>=z0 and hi<=z1 for x0,x1,z0,z1 in openings):continue
   a.box(plaster,[(l+r)/2,-2.89,(lo+hi)/2],[r-l,.22,hi-lo])
 a.box(plaster,[0,2.89,2.0],[8,.22,2.56])
 for side in (-1,1):a.box(plaster,[side*3.89,0,2],[.22,5.56,2.56])
 # Solid recessed door, framed windows, real inset glazing and side shutters.
 a.box(dark,[0,-2.83,1.73],[1.05,.12,2.02])
 for j in range(7):a.box(wood,[-.45+j*.15,-2.915,1.73],[.135,.04,1.98])
 a.box(metal,[.36,-2.96,1.7],[.04,.08,.13])
 for x in (-2.35,2.35):
  a.box(glass,[x,-2.80,1.86],[1.20,.035,1.02])
  for sx in (-.66,.66):a.box(wood,[x+sx,-3.01,1.86],[.10,.18,1.3])
  for z in (1.25,2.47):a.box(wood,[x,-3.01,z],[1.42,.18,.10])
  a.box(wood,[x,-2.94,1.86],[.05,.08,1.12]);a.box(wood,[x,-2.94,1.86],[1.28,.08,.05])
  for sign in (-1,1):
   for j in range(4):a.box(wood,[x+sign*(.91+j*.08),-3.04,1.86],[.07,.08,1.2])
  a.box(dark,[x,-3.20,1.07],[1.42,.43,.27]);a.box(wood,[x,-3.43,1.1],[1.5,.06,.31])
 for x in (-3.94,-1.38,1.38,3.94):a.box(wood,[x,-3.015,2.0],[.15,.20,2.65])
 for z in (.78,3.28):a.box(wood,[0,-3.02,z],[8.18,.22,.19])
 # Upper storey and gables are individually editable planks.
 for j in range(40):
  x=-3.9+j*.2;top=6.8-abs(x)*.45
  for y in (-2.98,2.98):
   low=3.48
   # Front loft opening is a framed aperture rather than painted-on glass.
   if y<0 and abs(x)<.7:
    a.box(wood,[x,y,(5.55+top)/2],[.186,.16,top-5.55])
   else:a.box(wood,[x,y,(low+top)/2],[.186,.16,top-low])
 for sign in (-1,1):a.box(wood,[sign*3.91,0,4.20],[.18,5.9,1.50])
 a.box(glass,[0,-2.91,4.52],[1.30,.035,1.96])
 for x in (-.73,.73):a.box(dark,[x,-3.08,4.52],[.10,.17,2.13])
 a.box(dark,[0,-3.08,5.59],[1.55,.17,.11])
 # Front balcony: load-bearing joists, floorboards and continuous handrail.
 for j in range(28):a.box(wood,[-3.38+j*.25,-3.67,3.43],[.236,1.39,.11])
 for x in (-3.45,-1.7,0,1.7,3.45):a.box(dark,[x,-3.62,3.22],[.16,1.65,.22])
 for j in range(29):a.box(wood,[-3.45+j*.246,-4.35,3.98],[.075,.08,.95])
 a.box(wood,[0,-4.35,4.49],[7.14,.15,.13])
 for x in (-3.54,3.54):
  a.box(wood,[x,-3.69,4.49],[.15,1.46,.13])
  for y in (-4.31,-3.67,-3.05):a.box(wood,[x,y,3.98],[.1,.1,.95])
 # Two-pitch roof with thickness, extended eaves and many shingle courses.
 slope=.45;ridge=6.88
 for sign in (-1,1):
  a.quad(dark,[0,-4.03,ridge],[sign*4.80,-4.03,ridge-4.80*slope],[sign*4.80,3.84,ridge-4.80*slope],[0,3.84,ridge])
  for row in range(17):
   x=(row+.5)*4.8/17
   for col in range(24):
    y=-3.88+col*.328+(row%2)*.08;half=.174;dx=.16
    z= ridge-x*slope+.035+rng.uniform(-.008,.008)
    a.quad(slate,[sign*(x-dx),y-half,z+dx*slope],[sign*(x+dx),y-half,z-dx*slope],[sign*(x+dx),y+half,z-dx*slope],[sign*(x-dx),y+half,z+dx*slope])
 for sign in (-1,1):a.tube(wood,[[0,-4.06,ridge+.02],[sign*4.84,-4.06,ridge-4.84*slope+.02]],[.095,.095],5)
 # Door steps, chimney and flower-box plants complete construction cues.
 for j in range(3):a.box(stone,[0,-3.2-j*.3,.54-j*.18],[1.55,.65,.18])
 a.box(stone,[2.25,1.3,6.22],[.65,.72,2.1]);a.box(slate,[2.25,1.3,7.31],[.88,.94,.14])
 return a


def render(asset,path,width=1200):
 os.environ['DRJIT_CACHE_DIR']=str((path.parent/'renderer-cache').resolve())
 import mitsuba as mi
 mi.set_variant('scalar_rgb');T=mi.ScalarTransform4f
 vertices=np.concatenate([np.asarray(p['v']) for p in asset.parts if p['v']]);lo=vertices.min(0);hi=vertices.max(0);size=max(hi-lo);centre=(lo+hi)/2
 scene={'type':'scene','integrator':{'type':'path','max_depth':5},'sky':{'type':'constant','radiance':{'type':'rgb','value':[.65,.78,1.0]}},'light':{'type':'rectangle','to_world':T.look_at(origin=[-size,-size,2*size],target=centre.tolist(),up=[0,0,1])@T.scale([size,size,1]),'emitter':{'type':'area','radiance':{'type':'rgb','value':[8,7.5,6.6]}}},'ground':{'type':'rectangle','to_world':T.translate([0,0,-.018])@T.scale([100,100,1]),'bsdf':{'type':'diffuse','reflectance':{'type':'rgb','value':[.28,.32,.23]}}},'sensor':{'type':'perspective','fov':34,'to_world':T.look_at(origin=(centre+np.array([1.38,-2.18,.92])*size).tolist(),target=centre.tolist(),up=[0,0,1]),'sampler':{'type':'independent'},'film':{'type':'hdrfilm','width':width,'height':round(width*.8),'rfilter':{'type':'tent'}}}}
 for i,p in enumerate(asset.parts):
  if not p['v']:continue
  color,rough=MATERIALS[p['material']];bsdf={'type':'diffuse','reflectance':{'type':'rgb','value':color}}
  if p['material'].startswith(('needle','grass','petal')):bsdf={'type':'twosided','bsdf':bsdf}
  props=mi.Properties();props['bsdf']=mi.load_dict(bsdf);mesh=mi.Mesh(p['name'],len(p['v']),len(p['f']),props,has_vertex_normals=True);params=mi.traverse(mesh);params['vertex_positions']=np.asarray(p['v'],np.float32).ravel();params['vertex_normals']=np.asarray(p['n'],np.float32).ravel();params['faces']=np.asarray(p['f'],np.uint32).ravel();params.update();scene['part_'+str(i)]=mesh
 mi.util.write_bitmap(str(path),mi.render(mi.load_dict(scene),spp=48,seed=1597))


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--render',action='store_true');args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
 calibration=Asset('axis-calibration-v01')
 for name,center,size in [('Axis_East_2m',[1,0,0],[2,.06,.06]),('Axis_North_3m',[0,1.5,0],[.06,3,.06]),('Axis_Up_4m',[0,0,2],[.06,.06,4])]:
  part=calibration.part(name,'wood');calibration.box(part,center,size)
 calibration.save(args.output/'axis-calibration-v01.glb')
 reports=[]
 for asset in [spruce(),meadow(),chalet()]:
  print('Building',asset.name,flush=True);record=asset.save(args.output/(asset.name+'.glb'))
  if args.render:render(asset,args.output/(asset.name+'.png'));record['offlineRender']=asset.name+'.png'
  reports.append(record);print(json.dumps(record),flush=True)
 (args.output/'manifest.json').write_text(json.dumps({'schema':'yunxiu-ecosystem-study/1','seed':1597,'assets':reports,'blenderExecuted':False,'unrealExecuted':False,'materialStatus':'authored flat PBR colours; bark grain, plaster microdetail, opacity, wind and realistic material response pending','notGameScreenshot':True},indent=2)+'\n')
if __name__=='__main__':main()
