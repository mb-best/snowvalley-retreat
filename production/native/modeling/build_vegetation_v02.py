"""Deterministic alpine vegetation studies with independently authored LOD geometry.
No alpha textures, external meshes or final art/performance acceptance implied.
"""
import argparse
import json
import math
from pathlib import Path
import numpy as np
from build_ecosystem import Asset, MATERIALS, meadow, render


def blade(a,p,root,tip,width,side):
 root=np.asarray(root);tip=np.asarray(tip);side=np.asarray(side)*width
 mid=root+(tip-root)*.57+np.array([0,0,width*.8])
 a.quad(p,root-side*.20,mid-side,mid,root)
 a.quad(p,root,mid,mid+side,root+side*.20)
 a.tri(p,mid-side,tip,mid);a.tri(p,mid,tip,mid+side)


def spruce(lod,seed=1597):
 a=Asset(f'alpine-spruce-v02-lod{lod}');rng=np.random.default_rng(seed)
 bark=a.part('Trunk_and_branches','bark')
 greens=[a.part('Needles_shade','needle'),a.part('Needles_new_growth','needle_light')]
 height=10.8
 a.tube(bark,[[.06*math.sin(j*.5),.035*math.cos(j*.8),height*j/12] for j in range(13)], [.22*(1-j/13)**1.1+.006 for j in range(13)],max(5,10-lod*2))
 for j in range(6):
  theta=j*2.39996;d=np.array([math.cos(theta),math.sin(theta),0])
  a.tube(bark,[d*.08+[0,0,.2],d*.65+[0,0,.035]],[.12,.012],5)
 # Irregular spiralling attachment points prevent perfectly stacked umbrella whorls.
 for j in range(82):
  z=1.15+j*.111+rng.uniform(-.08,.08);t=j*2.39996+rng.uniform(-.18,.18)
  d=np.array([math.cos(t),math.sin(t),0]);s=np.array([-d[1],d[0],0])
  length=2.5*(1-z/height)**.76*rng.uniform(.86,1.12)
  root=np.array([.03*math.sin(z),0,z]);end=root+d*length+[0,0,-.31*(1-z/height)+.08]
  if lod<2:a.tube(bark,[root,root+d*length*.5+[0,0,-.18],end],[.033*(1-z/height)+.005,.012,.0015],5)
  # Wide compound shoots retain silhouette at distance, no green particle spheres.
  shoots=[7,5,3][lod]
  for k in range(shoots):
   u=(k+.6)/shoots;attach=root*(1-u)+end*u
   for sign in [-1,1]:
    reach=(.16+.48*(1-u))*length
    tip=attach+d*.14+sign*s*reach+[0,0,.04]
    if lod==0:a.tube(bark,[attach,tip],[.004,.0008],4)
    for n in range([3,2,1][lod]):
     v=(n+.4)/[3,2,1][lod];base=attach*(1-v)+tip*v
     # Longer, narrow pointed leaf fans; two opposed ridges give a full canopy.
     for direction in [-1,1]:
      leaf_end=base+d*(.14+.12*(1-u))+s*sign*.04+[0,0,.035*direction]
      blade(a,greens[int((j+k+n)%7==0)],base,leaf_end,[.037,.065,.13][lod],s)
 return a


def fern(lod):
 a=Asset(f'alpine-fern-v01-lod{lod}');rng=np.random.default_rng(1597)
 stem=a.part('Curved_frond_stems','grass');leaves=a.part('Tapered_pinnae','grass_light')
 for j in range(11):
  t=j*2.39996;d=np.array([math.cos(t),math.sin(t),0]);s=np.array([-d[1],d[0],0]);length=rng.uniform(.38,.68)
  def curve(u):return d*length*u+np.array([0,0,.03+length*(1.6*u-1.15*u*u)])
  a.tube(stem,[curve(u) for u in np.linspace(0,1,7)],[.004*(1-u)+.0006 for u in np.linspace(0,1,7)],4)
  count=[14,7][lod]
  for k in range(count):
   u=(k+1)/(count+1);base=curve(u);span=length*.28*math.sin(math.pi*u)**.7*(1-u*.35)
   for sign in [-1,1]:blade(a,leaves,base,base+sign*s*span+d*.035+[0,0,.018],span*.19,d)
 return a


def flowers():
 a=meadow(1598);a.name='alpine-meadow-v02-lod0'
 p=a.part('Flower_basal_lanceolate_leaves','grass')
 rng=np.random.default_rng(1598)
 for j in range(44):
  t=rng.uniform(0,2*np.pi);r=rng.uniform(0,.33);d=np.array([math.cos(t),math.sin(t),0]);s=np.array([-d[1],d[0],0]);root=d*r
  blade(a,p,root,root+d*rng.uniform(.06,.15)+[0,0,rng.uniform(.07,.16)],.016,s)
 return a


def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True);parser.add_argument('--render',action='store_true');args=parser.parse_args()
 args.output.mkdir(parents=True,exist_ok=True);records=[]
 for a in [spruce(0),spruce(1),spruce(2),fern(0),fern(1),flowers()]:
  record=a.save(args.output/(a.name+'.glb'));records.append(record);print(json.dumps(record),flush=True)
  if args.render and a.name.endswith('lod0'):render(a,args.output/(a.name+'.png'),1000)
 for family in ['alpine-spruce-v02','alpine-fern-v01']:
  family_records=[r for r in records if r['id'].startswith(family)]
  for i,r in enumerate(family_records):r['lod']=i;r['triangleFractionOfLOD0']=r['triangles']/family_records[0]['triangles']
 (args.output/'manifest.json').write_text(json.dumps({'schema':'yunxiu-vegetation-study/2','seed':1597,'assets':records,'lodStatus':'separate authored GLBs, not yet engine-bound LODs; silhouette and popping require realtime review','materialStatus':'flat PBR colours; UV textures, wind and subsurface pending','blenderExecuted':False,'unrealExecuted':False,'notGameScreenshot':True},indent=2)+'\n')
if __name__=='__main__':main()
