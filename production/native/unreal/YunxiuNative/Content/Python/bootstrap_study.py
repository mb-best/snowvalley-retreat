"""Run only in the freshly launched, compiled YunxiuNative editor process.
Import portable samples, verify importer axes/scale, then create a fresh study map.
No runtime or visual acceptance is claimed until this executes successfully.
"""
import json
import math
from pathlib import Path
import unreal


def import_meshes(source,destination):
 if unreal.EditorAssetLibrary.does_directory_exist(destination):
  raise FileExistsError('Use a fresh import destination; existing assets will not be replaced: '+destination)
 task=unreal.AssetImportTask()
 task.set_editor_property('filename',str(source))
 task.set_editor_property('destination_path',destination)
 task.set_editor_property('automated',True)
 task.set_editor_property('save',True)
 task.set_editor_property('replace_existing',False)
 unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 paths=unreal.EditorAssetLibrary.list_assets(destination,recursive=True,include_folder=False)
 meshes=[unreal.load_asset(p) for p in paths]
 meshes=[m for m in meshes if isinstance(m,unreal.StaticMesh)]
 if not meshes: raise RuntimeError('No imported static mesh for '+str(source))
 return meshes


def calibrated_rotation(meshes):
 basis=[]
 for name,length in [('Axis_East_2m',2),('Axis_North_3m',3),('Axis_Up_4m',4)]:
  matches=[m for m in meshes if name in m.get_name()]
  if len(matches)!=1: raise RuntimeError('Axis calibration mesh missing or combined: '+name)
  bounds=matches[0].get_bounding_box();lo,hi=bounds.min,bounds.max
  dims=[hi.x-lo.x,hi.y-lo.y,hi.z-lo.z]
  if abs(max(dims)-length*100)>1:
   raise RuntimeError('Importer did not preserve metre-to-centimetre scale: '+name)
  center=[(hi.x+lo.x)/2,(hi.y+lo.y)/2,(hi.z+lo.z)/2]
  magnitude=math.sqrt(sum(v*v for v in center))
  if magnitude<1:raise RuntimeError('Importer recentered geometry; inspect pivot before proceeding')
  basis.append([v/magnitude for v in center])
 if any(abs(sum(a*b for a,b in zip(basis[i],basis[j])))>.001 for i in range(3) for j in range(i)):
  raise RuntimeError('Importer calibration axes are not orthogonal')
 # Desired directions: East=+X, North=-Y, Up=+Z in the UE scene.
 # R = desired_basis * imported_basis^T; positive determinant is mandatory.
 rows=[basis[0],[-v for v in basis[1]],basis[2]]
 det=(rows[0][0]*(rows[1][1]*rows[2][2]-rows[1][2]*rows[2][1])-rows[0][1]*(rows[1][0]*rows[2][2]-rows[1][2]*rows[2][0])+rows[0][2]*(rows[1][0]*rows[2][1]-rows[1][1]*rows[2][0]))
 if abs(det-1)>.002:raise RuntimeError('Unexpected importer handedness; stop before placing samples')
 columns=[unreal.Vector(*(rows[r][c] for r in range(3))) for c in range(3)]
 return unreal.MathLibrary.make_rotation_from_axes(*columns)


def main():
 source=Path(unreal.Paths.project_content_dir())/'NativeSource'
 receipt=json.loads((source/'staging-manifest.json').read_text())
 if receipt['sourceRevision']!=1597:raise ValueError('Wrong frozen map revision')
 level='/Game/Maps/YunxiuStudy'
 if unreal.EditorAssetLibrary.does_asset_exist(level):
  unreal.log_warning('Existing study map preserved; bootstrap will not overwrite it.')
  return
 axes=import_meshes(source/'axis-calibration-v01.glb','/Game/Imported/Calibration_v01')
 rotation=calibrated_rotation(axes)
 samples={}
 for name in ['alpine-spruce-structure-v01','alpine-meadow-clump-v01','swiss-timber-stone-house-v01']:
  samples[name]=import_meshes(source/(name+'.glb'),'/Game/Imported/'+name.replace('-','_'))
 world=unreal.EditorLoadingAndSavingUtils.new_blank_map(False)
 subsystem=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
 terrain_class=unreal.load_class(None,'/Script/YunxiuNative.YunxiuStudyTerrain')
 if terrain_class is None:raise RuntimeError('Compile YunxiuNativeEditor before running this script')
 terrain=subsystem.spawn_actor_from_class(terrain_class,unreal.Vector(0,0,0))
 if not terrain.build_reference_terrain():raise RuntimeError('Terrain source failed to load')
 for actor_class in [unreal.SkyAtmosphere,unreal.SkyLight]:subsystem.spawn_actor_from_class(actor_class,unreal.Vector(0,0,0))
 sun=subsystem.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,0,130000),unreal.Rotator(-38,-25,0))
 sun.set_actor_label('Study_sun_lighting_pending_review')
 placements=[('swiss-timber-stone-house-v01',1017.2768,-3107.3004),('alpine-spruce-structure-v01',1002,-3095),('alpine-meadow-clump-v01',1027,-3120)]
 for name,east,south in placements:
  x,y=east-1150,south+3200;h=terrain.height_at_local_metres(x,y)
  if not math.isfinite(h):raise ValueError('Sample outside reference patch')
  for mesh in samples[name]:
   actor=subsystem.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(x*100,y*100,h*100),rotation)
   actor.static_mesh_component.set_static_mesh(mesh)
   actor.set_actor_label('REVIEW_ONLY_'+mesh.get_name())
 unreal.EditorAssetLibrary.make_directory('/Game/Maps')
 if not unreal.EditorLoadingAndSavingUtils.save_map(world,level):raise RuntimeError('Study map could not be saved')
 report={'engine':unreal.SystemLibrary.get_engine_version(),'map':level,'sourceRevision':1597,'axesAndScaleChecked':True,'editorImportExecuted':True,'cppCompiled':True,'playTested':False,'artAccepted':False,'note':'Press Play to inspect collision/movement, then review lighting, materials and performance; terrain and source actor placements must be checked visually.'}
 out=Path(unreal.Paths.project_saved_dir())/'yunxiu-editor-bootstrap.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n')
 unreal.log('Yunxiu study imported and saved; PIE and art acceptance remain pending.')
if __name__=='__main__':main()
