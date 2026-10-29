"""Import the portable rock/moss sample and save an editable packed Blender file.
Run only in a fresh --background --factory-startup session. Not executed in the
restricted environment because its Metal device detection crashes before Python.
"""
import argparse
import json
import sys
from pathlib import Path


def main():
    import bpy
    from mathutils import Vector
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if not bpy.app.background or bpy.data.filepath:
        raise RuntimeError('Use a fresh background process; an open project will not be replaced')
    if args.output.exists():
        raise FileExistsError('Choose a new output directory')
    args.output.mkdir(parents=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(args.model.resolve()))
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    corners=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
    lo=Vector(tuple(min(p[k] for p in corners) for k in range(3)))
    hi=Vector(tuple(max(p[k] for p in corners) for k in range(3)))
    offset=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for obj in objects:obj.location-=offset
    size=max(hi-lo)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012))
    ground=bpy.context.object;ground.name='Material_Study_Ground'
    material=bpy.data.materials.new('Study_Ground');material.diffuse_color=(.34,.37,.29,1)
    ground.data.materials.append(material)
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
    world=bpy.data.worlds.new('Cool_Studio_Sky');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.7,.84,1.05,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7;scene.world=world
    light_data=bpy.data.lights.new('Warm_Area_Key','AREA');light_data.energy=1100
    light_data.shape='DISK';light_data.size=size*2.2;light_data.color=(1,.9,.76)
    light=bpy.data.objects.new(light_data.name,light_data);scene.collection.objects.link(light)
    light.location=(-2*size,-2*size,3*size)
    light.rotation_euler=(Vector((0,0,.4*size))-light.location).to_track_quat('-Z','Y').to_euler()
    camera_data=bpy.data.cameras.new('Rock_Study_Camera');camera=bpy.data.objects.new(camera_data.name,camera_data)
    scene.collection.objects.link(camera);camera.location=(1.25*size,-1.72*size,1.05*size)
    camera.rotation_euler=(Vector((0,0,.30*size))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.lens=58;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=96;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=980;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene['asset_status']='rock/moss sample, not a game scene or final art approval'
    scene['source']='Boulder 01, Rico Cilliers, Poly Haven, CC0-1.0; separate Yunxiu moss mesh'
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str((args.output/'yunxiu-rock-moss.blend').resolve()))
    if args.render:
        scene.render.filepath=str((args.output/'blender-rock-moss.png').resolve())
        bpy.ops.render.render(write_still=True)
    (args.output/'execution.json').write_text(json.dumps({'blender':bpy.app.version_string,'blendSaved':True,'cyclesRendered':args.render,'notGameScreenshot':True},indent=2)+'\n')


if __name__=='__main__':
    main()
