"""Create an editable GEOGRAPHY REFERENCE, not a finished art scene.

blender --background --python import_geography.py -- --bundle BUNDLE --output STUDY.blend
The world proxy and the 1m detail mesh start hidden to avoid overlapping surfaces.
Only the 5m context is visible. The exact world proxy retains original diagonals.
This script has not yet been run in Blender; syntax checking is not engine QA.
"""
import argparse
import array
import json
import sys
from pathlib import Path


def read_floats(filename):
    values = array.array('f')
    values.frombytes(Path(filename).read_bytes())
    if sys.byteorder != 'little':
        values.byteswap()
    return values


def geometry(columns, rows, spacing, origin, heights, altitude_base=1700):
    if len(heights) != columns * rows:
        raise ValueError('Grid byte count does not match dimensions')
    # Unreal: east/south/up. Blender: east/north/up, so reverse south.
    vertices = [(origin[0] + i * spacing, -(origin[1] + j * spacing),
                 heights[j * columns + i] - altitude_base)
                for j in range(rows) for i in range(columns)]
    faces = []
    for j in range(rows - 1):
        for i in range(columns - 1):
            a = j * columns + i
            # Same B-C diagonal and interpolation as Geography.baseHeight.
            # Positive-up winding after reversing the south axis.
            faces.extend(((a, a + columns, a + 1),
                          (a + 1, a + columns, a + columns + 1)))
    return vertices, faces


def main():
    import bpy
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    options = parser.parse_args(args)
    if options.output.exists():
        raise FileExistsError('Choose a new output file; existing .blend will not be overwritten')
    manifest = json.loads((options.bundle / 'manifest.json').read_text())
    study = json.loads((options.bundle / 'study.json').read_text())
    name = 'Yunxiu_Geography_1597'
    if bpy.data.collections.get(name):
        raise RuntimeError('Geography collection already exists; use a fresh scene')
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1
    material = bpy.data.materials.new('Yunxiu_Technical_Grey_NOT_FINAL_ART')
    material.diffuse_color = (.36, .43, .35, 1)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.36, .43, .35, 1)
    shader.inputs['Roughness'].default_value = .9

    def mesh(name, columns, rows, spacing, origin, filename, hidden):
        vertices, faces = geometry(columns, rows, spacing, origin, read_floats(options.bundle / filename))
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        data.materials.append(material)
        obj.hide_render = hidden
        obj.hide_set(hidden)
        obj['source_revision'] = 1597
        obj['source_map_sha256'] = manifest['source']['sha256']
        obj['status'] = 'Geography reference only; no final assets, water shader, collision or gameplay'
        return obj

    source = manifest['authoritativeTerrain']
    mesh('WorldProxy_ExactBase_50m', source['columns'], source['rows'],
         source['spacingMetres'], source['originEastSouth'], source['file'], True)
    for grid in study['grids']:
        mesh('Study_' + grid['id'], grid['columns'], grid['rows'], grid['spacing'],
             grid['originEastSouth'], grid['file'], grid['id'] == 'detail')
    scene = bpy.context.scene
    scene['yunxiu_status'] = 'Technical geography import; not an art-quality delivery'
    scene['yunxiu_axis_note'] = 'X east, Y north, Z absolute altitude minus 1700m; metres'
    options.output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(options.output.resolve()))
    print('Saved geography reference:', options.output)


if __name__ == '__main__':
    main()
