"""Import the three GLB studies into an editable Blender review scene.
Run in a fresh background Blender process in the user's ordinary Terminal.
No existing project/output is overwritten. This script has not yet run in Blender.
"""
import argparse
import json
import sys
from pathlib import Path


def main():
 import bpy
 from mathutils import Vector
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--assets',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--render',action='store_true');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
 if not bpy.app.background or bpy.data.filepath:raise RuntimeError('A fresh background process is required')
 if args.output.exists():raise FileExistsError('Use a new output directory')
 args.output.mkdir(parents=True)
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 manifest=json.loads((args.assets/'manifest.json').read_text())
 names=[r['id'] for r in manifest['assets'] if r.get('lod',0)==0]
 for i,name in enumerate(names):
  offset=(i*8-8,0,0)
  before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str((args.assets/(name+'.glb')).resolve()))
  imported=set(scene.objects)-before
  collection=bpy.data.collections.new(name);scene.collection.children.link(collection)
  for obj in imported:
   for old in list(obj.users_collection):old.objects.unlink(obj)
   collection.objects.link(obj)
   if obj.parent is None:obj.location+=Vector(offset)
   obj['yunxiu_asset_status']='editable structure study; art, wind, collision and LOD pending'
 for material in bpy.data.materials:
  if not material.use_nodes:continue
  shader=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if shader is None:continue
  if material.name.startswith(('bark','wood','plaster','stone')):
   nodes=material.node_tree.nodes;links=material.node_tree.links
   noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=42 if material.name.startswith(('stone','plaster')) else 16
   tex=nodes.new('ShaderNodeTexCoord');links.new(tex.outputs['Generated'],noise.inputs['Vector'])
   bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.15;bump.inputs['Distance'].default_value=.003
   links.new(noise.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],shader.inputs['Normal'])
 world=bpy.data.worlds.new('Review_sky');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.78,1,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65;scene.world=world
 data=bpy.data.lights.new('Review_area','AREA');data.energy=5000;data.size=15
 lamp=bpy.data.objects.new('Review_area',data);scene.collection.objects.link(lamp);lamp.location=(-9,-12,19);lamp.rotation_euler=(Vector((0,0,4))-lamp.location).to_track_quat('-Z','Y').to_euler()
 data=bpy.data.cameras.new('Review_camera');camera=bpy.data.objects.new('Review_camera',data);scene.collection.objects.link(camera);camera.location=(25,-37,23);camera.rotation_euler=(Vector((0,-.5,4))-camera.location).to_track_quat('-Z','Y').to_euler();data.lens=42;scene.camera=camera
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64;scene.cycles.use_denoising=True
 scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
 scene['status']='Tree, grass/flower and chalet review studies. Not a final accepted scene or UE screenshot.'
 note=bpy.data.texts.new('READ_ME');note.write('Metres, editable meshes grouped by sample.\nHouse board 06 was not selected: this is a separate review study.\nTree crown, grass/petal shape and all realistic material work remain pending. LOD files remain separate and are not bound to engine distance switches.\n')
 bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'yunxiu-ecosystem-study.blend').resolve()))
 if args.render:
  scene.render.filepath=str((args.output/'blender-ecosystem-study.png').resolve());bpy.ops.render.render(write_still=True)
 (args.output/'execution.json').write_text(json.dumps({'blender':bpy.app.version_string,'blendSaved':True,'rendered':args.render,'artAccepted':False,'notGameScreenshot':True},indent=2)+'\n')
if __name__=='__main__':main()
