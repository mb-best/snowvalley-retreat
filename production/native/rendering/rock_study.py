"""Render an actual scanned mesh using a CPU path tracer; not a game screenshot.

Requires mitsuba==3.9.1, numpy and pillow. No Metal/GPU context is requested.
The original glTF and textures remain unchanged. The GLB embeds those exact bytes.
"""
import argparse
import hashlib
import json
import os
import struct
import time
from pathlib import Path


def pack_glb(source, target):
    doc = json.loads(source.read_text())
    blob = bytearray((source.parent / doc['buffers'][0]['uri']).read_bytes())
    doc['buffers'] = [{'byteLength': len(blob)}]
    for image in doc.get('images', []):
        while len(blob) % 4:
            blob.append(0)
        data = (source.parent / image.pop('uri')).read_bytes()
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
        image['bufferView'] = view
        blob.extend(data)
    doc['buffers'][0]['byteLength'] = len(blob)
    text = json.dumps(doc, separators=(',', ':')).encode()
    text += b' ' * ((-len(text)) % 4)
    blob.extend(b'\0' * ((-len(blob)) % 4))
    total = 12 + 8 + len(text) + 8 + len(blob)
    target.write_bytes(struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(blob), b'BIN\0') + blob)


def add_moss_glb(source, target, vertices, normals, colors, uv, faces, normal_png):
    data=source.read_bytes()
    json_size=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+json_size])
    binary_start=20+json_size+8
    blob=bytearray(data[binary_start:binary_start+doc['buffers'][0]['byteLength']])
    def attribute(array,component_type,kind):
        while len(blob)%4:blob.append(0)
        raw=array.tobytes();view=len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(raw)})
        blob.extend(raw)
        accessor=len(doc['accessors'])
        entry={'bufferView':view,'componentType':component_type,'count':len(array),'type':kind}
        if kind=='VEC3':entry.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
        doc['accessors'].append(entry)
        return accessor
    position=attribute(vertices.astype('<f4'),5126,'VEC3')
    normal=attribute(normals.astype('<f4'),5126,'VEC3')
    color=attribute(colors.astype('<f4'),5126,'VEC3')
    texcoord=attribute(uv.astype('<f4'),5126,'VEC2')
    index=attribute(faces.astype('<u4').ravel(),5125,'SCALAR')
    while len(blob)%4:blob.append(0)
    image_view=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(normal_png)})
    blob.extend(normal_png)
    image_id=len(doc['images']);doc['images'].append({'name':'Yunxiu_Moss_Micro_Normal','bufferView':image_view,'mimeType':'image/png'})
    texture_id=len(doc['textures']);doc['textures'].append({'source':image_id})
    material=len(doc['materials'])
    doc['materials'].append({'name':'Yunxiu_Moss_Geometry_v02','doubleSided':True,'normalTexture':{'index':texture_id},'pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':.95}})
    mesh=len(doc['meshes'])
    doc['meshes'].append({'name':'Moss_Leaf_Clumps','primitives':[{'attributes':{'POSITION':position,'NORMAL':normal,'COLOR_0':color,'TEXCOORD_0':texcoord},'indices':index,'material':material}]})
    node=len(doc['nodes']);doc['nodes'].append({'name':'Yunxiu_Moss_Geometry_v02','mesh':mesh})
    doc['scenes'][doc.get('scene',0)]['nodes'].append(node)
    doc['extras']={'artStatus':'rock-and-moss asset sample; not final art acceptance','baseAsset':'Boulder 01, Rico Cilliers, CC0-1.0','mossGeometry':'Yunxiu procedural leaf clumps; a separate editable mesh'}
    doc['buffers'][0]['byteLength']=len(blob)
    text=json.dumps(doc,separators=(',',':')).encode();text+=b' '*((-len(text))%4)
    blob.extend(b'\0'*((-len(blob))%4))
    target.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(text)+len(blob))+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(blob),b'BIN\0')+blob)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--asset', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--width', type=int, default=1100)
    parser.add_argument('--spp', type=int, default=48)
    parser.add_argument('--moss', action='store_true')
    options = parser.parse_args()
    options.output.mkdir(parents=True, exist_ok=True)
    cache = options.output / 'renderer-cache'
    cache.mkdir(exist_ok=True)
    os.environ['DRJIT_CACHE_DIR'] = str(cache.resolve())
    import numpy as np
    import mitsuba as mi
    from PIL import Image
    mi.set_variant('scalar_rgb')
    if hasattr(mi, 'set_thread_count'):
        mi.set_thread_count(4)
    print('CPU renderer ready:', mi.__version__, mi.variant(), flush=True)
    source = options.asset / 'boulder_01_2k.gltf'
    manifest = json.loads((options.asset / 'verified-files.json').read_text())
    for record in manifest:
        data = (options.asset / record['path']).read_bytes()
        if hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError('Asset checksum changed: ' + record['path'])
    gltf = json.loads(source.read_text())
    binary = (options.asset / gltf['buffers'][0]['uri']).read_bytes()
    component_types = {5126:'<f4', 5125:'<u4', 5123:'<u2', 5121:'u1'}
    counts = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}

    def accessor(index):
        record = gltf['accessors'][index]
        view = gltf['bufferViews'][record['bufferView']]
        dtype = np.dtype(component_types[record['componentType']])
        columns = counts[record['type']]
        return np.ndarray((record['count'], columns), dtype=dtype, buffer=binary,
                          offset=view.get('byteOffset',0)+record.get('byteOffset',0),
                          strides=(view.get('byteStride', dtype.itemsize*columns), dtype.itemsize)).copy()

    primitive = gltf['meshes'][0]['primitives'][0]
    vertices = accessor(primitive['attributes']['POSITION']).astype(np.float32)
    normals = accessor(primitive['attributes']['NORMAL']).astype(np.float32)
    uv = accessor(primitive['attributes']['TEXCOORD_0']).astype(np.float32)
    faces = accessor(primitive['indices']).astype(np.uint32).reshape(-1,3)
    if not np.isfinite(vertices).all() or not np.isfinite(normals).all() or not np.isfinite(uv).all():
        raise ValueError('Non-finite mesh values')
    if faces.max() >= len(vertices):
        raise ValueError('Invalid triangle index')
    # glTF Y-up -> right-handed Z-up, preserving metres and winding.
    vertices = vertices[:, [0,2,1]] * np.array([1,-1,1],np.float32)
    normals = normals[:, [0,2,1]] * np.array([1,-1,1],np.float32)
    centre = (vertices.min(axis=0)+vertices.max(axis=0))/2
    original_offset=np.array([centre[0],centre[1],vertices[:,2].min()],np.float32)
    vertices[:,0:2] -= centre[0:2]
    vertices[:,2] -= vertices[:,2].min()
    # Mitsuba bitmap lookup uses the same image-row convention as this glTF.
    # Keep source UVs: flipping V misregisters the scanned colour/normal atlas.
    extent = vertices.max(axis=0)-vertices.min(axis=0)
    scale = float(max(extent))
    tex = options.asset / 'textures'
    arm = np.asarray(Image.open(tex/'boulder_01_arm_2k.jpg'), dtype=np.float32)/255
    rough = mi.Bitmap(np.ascontiguousarray(arm[:,:,1]))
    rock_bsdf = mi.load_dict({
        'type':'normalmap',
        'normalmap':{'type':'bitmap','filename':str((tex/'boulder_01_nor_gl_2k.jpg').resolve()),'raw':True},
        'bsdf':{'type':'principled','base_color':{'type':'bitmap','filename':str((tex/'boulder_01_diff_2k.jpg').resolve())},
                'roughness':{'type':'bitmap','bitmap':rough,'raw':True},'metallic':0.0}
    })
    props = mi.Properties()
    props['bsdf'] = rock_bsdf
    mesh = mi.Mesh('Boulder_01_Scan_CC0',len(vertices),len(faces),props,has_vertex_normals=True,has_vertex_texcoords=True)
    params = mi.traverse(mesh)
    params['vertex_positions'] = vertices.ravel()
    params['vertex_normals'] = normals.ravel()
    params['vertex_texcoords'] = uv.ravel()
    params['faces'] = faces.ravel()
    params.update()
    pack_glb(source,options.output/'boulder-01-source.glb')
    moss_mesh=None;moss_count=0;moss_faces_count=0
    if options.moss:
        # Centimetre-scale separate geometry. Patches follow surface orientation
        # and low-frequency spatial variation; no uniformly green rock coating.
        rng=np.random.default_rng(1597)
        tri=vertices[faces]
        area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
        probability=area/area.sum()
        positions=[];moss_normals=[];moss_colors=[];moss_faces=[]
        vertex_patch=.5+.26*np.sin(6*vertices[:,0]+4*vertices[:,1])+.16*np.sin(13*vertices[:,1]-5*vertices[:,2]+2*vertices[:,0])
        covered=(vertex_patch[faces].min(axis=1)>.71)&(normals[:,2][faces].min(axis=1)>.12)
        for face_id in np.flatnonzero(covered):
            ids=faces[face_id]
            k=len(positions)
            positions.extend(vertices[ids]+normals[ids]*.001)
            moss_normals.extend(normals[ids])
            for p in vertices[ids]:
                tone=.5+.5*np.sin(p[0]*27+p[1]*19+p[2]*12)
                moss_colors.append([.09+.045*tone,.15+.07*tone,.023+.014*tone])
            moss_faces.append([k,k+1,k+2])
        for face_id in rng.choice(len(faces),22000,p=probability):
            s,t=rng.random(2)
            if s+t>1:s,t=1-s,1-t
            p=tri[face_id,0]*(1-s-t)+tri[face_id,1]*s+tri[face_id,2]*t
            n=normals[faces[face_id,0]]*(1-s-t)+normals[faces[face_id,1]]*s+normals[faces[face_id,2]]*t
            n=n/max(np.linalg.norm(n),1e-8)
            patch=.5+.26*np.sin(6*p[0]+4*p[1])+.16*np.sin(13*p[1]-5*p[2]+2*p[0])
            if n[2]<.12 or patch<.70 or rng.random()>.62:continue
            ref=np.array([0,0,1.]) if abs(n[2])<.94 else np.array([1.,0,0])
            u=np.cross(n,ref);u/=np.linalg.norm(u);v=np.cross(n,u)
            hue=rng.random()
            col=np.array([.12+.06*hue,.20+.08*hue,.028+.02*hue],np.float32)
            stalk=rng.uniform(.004,.009)
            for leaf in range(5):
                angle=leaf*2.39996+rng.random()*.4
                direction=np.cos(angle)*u+np.sin(angle)*v
                side=np.cross(n,direction)
                length=rng.uniform(.002,.0045);width=length*.2
                root=p+n*(.001+stalk*(.15+.15*leaf))
                mid=root+direction*length*.45+n*length*.36
                tip=root+direction*length*.72+n*length*.7
                points=[root,mid+side*width,tip,mid-side*width]
                normal=np.cross(points[1]-points[0],points[2]-points[0]);normal/=max(np.linalg.norm(normal),1e-8)
                k=len(positions);positions.extend(points);moss_normals.extend([normal]*4);moss_colors.extend([col]*4)
                moss_faces.extend([[k,k+1,k+2],[k,k+2,k+3]])
            moss_count+=1
            if moss_count>=3400:break
        mp=np.array(positions,np.float32);mn=np.array(moss_normals,np.float32);mc=np.array(moss_colors,np.float32);mf=np.array(moss_faces,np.uint32)
        moss_faces_count=len(mf)
        # A small tangent-space normal texture gives the attached carpet visible
        # microstructure. It is embedded in GLB as well as used by the renderer.
        noise=rng.random((512,512),dtype=np.float32)
        for axis in (0,1):noise=(np.roll(noise,1,axis)+noise*2+np.roll(noise,-1,axis))/4
        gx=(np.roll(noise,-1,axis=1)-np.roll(noise,1,axis=1))*3.2
        gy=(np.roll(noise,-1,axis=0)-np.roll(noise,1,axis=0))*3.2
        normal_data=np.stack([-gx,-gy,np.ones_like(gx)],axis=2)
        normal_data/=np.linalg.norm(normal_data,axis=2,keepdims=True)
        normal_data=normal_data*.5+.5
        normal_path=options.output/'moss-micro-normal.png'
        Image.fromarray((normal_data*255+.5).astype(np.uint8)).save(normal_path)
        moss_uv=np.column_stack([(mp[:,0]*.87+mp[:,1]*.48)*4,(mp[:,0]*.2-mp[:,1]*.36+mp[:,2]*.91)*4]).astype(np.float32)
        prop=mi.Properties();prop['bsdf']=mi.load_dict({'type':'twosided','bsdf':{'type':'normalmap','normalmap':{'type':'bitmap','filename':str(normal_path.resolve()),'raw':True},'bsdf':{'type':'diffuse','reflectance':{'type':'mesh_attribute','name':'vertex_color'}}}})
        moss_mesh=mi.Mesh('Yunxiu_Moss_Leaf_Clumps',len(mp),len(mf),prop,has_vertex_normals=True,has_vertex_texcoords=True)
        moss_mesh.add_attribute('vertex_color',3,mc.ravel())
        par=mi.traverse(moss_mesh);par['vertex_positions']=mp.ravel();par['vertex_normals']=mn.ravel();par['vertex_texcoords']=moss_uv.ravel();par['faces']=mf.ravel();par.update()
        # Return the procedural geometry to the original glTF coordinate frame.
        global_positions=mp+original_offset
        gltf_positions=global_positions[:,[0,2,1]]*np.array([1,1,-1],np.float32)
        gltf_normals=mn[:,[0,2,1]]*np.array([1,1,-1],np.float32)
        add_moss_glb(options.output/'boulder-01-source.glb',options.output/'yunxiu-rock-moss-v02.glb',gltf_positions,gltf_normals,mc,moss_uv,mf,normal_path.read_bytes())
    T = mi.ScalarTransform4f
    base = {
        'type':'scene','integrator':{'type':'path','max_depth':6},
        'rock':mesh,
        'sky':{'type':'constant','radiance':{'type':'rgb','value':[.7,.84,1.05]}},
        'key':{'type':'rectangle','to_world':T.look_at(origin=[-2*scale,-2*scale,3*scale],target=[0,0,.4*scale],up=[0,1,0]) @ T.scale([1.1*scale,1.1*scale,1]),
               'emitter':{'type':'area','radiance':{'type':'rgb','value':[12,10.8,9.12]}}},
        'ground':{'type':'rectangle','to_world':T.translate([0,0,-.012]) @ T.scale([200,200,1]),'bsdf':{'type':'diffuse','reflectance':{'type':'rgb','value':[.34,.37,.29]}}},
        'sensor':{'type':'perspective','fov':34,'to_world':T.look_at(origin=[1.25*scale,-1.72*scale,1.05*scale],target=[0,0,.30*scale],up=[0,0,1]),
                  'sampler':{'type':'independent'},'film':{'type':'hdrfilm','width':options.width,'height':round(options.width*.7),'rfilter':{'type':'tent'}}}
    }
    if moss_mesh is not None:base['moss']=moss_mesh
    started=time.monotonic()
    scene=mi.load_dict(base)
    print('Rendering scanned rock:', len(faces), 'triangles', flush=True)
    image=mi.render(scene,spp=options.spp,seed=1597)
    image_name='rock-moss-study-v02.png' if options.moss else 'rock-material-study-v01.png'
    mi.util.write_bitmap(str(options.output/image_name),image)
    report={
        'schema':'yunxiu-material-study/1','asset':'Boulder 01','author':'Rico Cilliers','license':'CC0-1.0',
        'source':'https://polyhaven.com/a/boulder_01','credit':'Powered by Poly Haven',
        'renderer':'Mitsuba '+mi.__version__,'variant':mi.variant(),'renderSeconds':round(time.monotonic()-started,3),
        'triangles':len(faces),'vertices':len(vertices),'dimensionsMetres':extent.tolist(),
        'textures':{'baseColor':'sRGB bitmap','normal':'linear OpenGL normal bitmap','roughness':'linear green channel of original ARM bitmap'},
        'geometry':'real scanned triangles; GLB embeds original mesh and textures without resampling',
        'mossClumps':moss_count,'mossTriangles':moss_faces_count,
        'artStatus':'rock and separate moss geometry sample; wetness masks, close-view LOD and engine behaviour pending' if options.moss else 'material baseline, before custom moss geometry, wetness masks and final palette tuning',
        'notGameScreenshot':True,'blenderSceneExecution':'not completed: Metal initialisation crash','unrealExecution':'not attempted: editor absent'
    }
    (options.output/'study-report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2),flush=True)


if __name__=='__main__':
    main()
