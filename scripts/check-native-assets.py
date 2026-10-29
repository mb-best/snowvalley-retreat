"""Check generated GLB layout, finite accessors, mesh indices and embedded inputs.
This is a focused binary check, not Khronos conformance or engine acceptance.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def load_glb(path):
    raw=path.read_bytes()
    magic,version,size=struct.unpack_from('<4sII',raw)
    assert magic==b'glTF' and version==2 and size==len(raw),path
    n,kind=struct.unpack_from('<I4s',raw,12)
    assert kind==b'JSON' and n%4==0
    doc=json.loads(raw[20:20+n])
    count,kind=struct.unpack_from('<I4s',raw,20+n)
    assert kind==b'BIN\0' and count%4==0 and 28+n+count==len(raw)
    blob=raw[28+n:]
    assert doc['buffers'][0]['byteLength']<=len(blob)
    for view in doc['bufferViews']:
        assert view.get('buffer',0)==0
        assert view.get('byteOffset',0)+view['byteLength']<=doc['buffers'][0]['byteLength']

    def accessor(index):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        component={5126:('f',4),5125:('I',4),5123:('H',2),5121:('B',1)}[a['componentType']]
        columns={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        length=component[1]*columns;stride=v.get('byteStride',length);offset=a.get('byteOffset',0)
        assert offset+(a['count']-1)*stride+length<=v['byteLength']
        start=v.get('byteOffset',0)+offset
        return [struct.unpack_from('<'+component[0]*columns,blob,start+i*stride) for i in range(a['count'])]

    triangles=0
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            vertices=accessor(primitive['attributes']['POSITION'])
            assert all(all(math.isfinite(x) for x in p) for p in vertices)
            position=doc['accessors'][primitive['attributes']['POSITION']]
            for axis in range(3):
                assert abs(position['min'][axis]-min(p[axis] for p in vertices))<1e-5
                assert abs(position['max'][axis]-max(p[axis] for p in vertices))<1e-5
            for name,index in primitive['attributes'].items():
                values=accessor(index)
                assert len(values)==len(vertices)
                assert all(all(math.isfinite(x) for x in p) for p in values)
                if name=='NORMAL':assert all(abs(sum(x*x for x in p)-1)<.005 for p in values)
            indices=accessor(primitive['indices'])
            assert len(indices)%3==0 and all(0<=p[0]<len(vertices) for p in indices)
            triangles+=len(indices)//3
    images=[]
    for image in doc.get('images',[]):
        assert 'uri' not in image,'GLB must be portable'
        v=doc['bufferViews'][image['bufferView']];data=blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        assert data.startswith(b'\xff\xd8') or data.startswith(b'\x89PNG')
        images.append(hashlib.sha256(data).hexdigest())
    return {'file':path.name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'meshes':len(doc['meshes']),'triangles':triangles,'embeddedImages':len(images)},images,blob


def main():
    generated=ROOT/'production/native/generated'
    paths=[generated/'material-study-v02/boulder-01-source.glb']
    paths+=sorted(generated.glob('material-study-v*/yunxiu-rock-moss-v*.glb'))
    paths+=list((generated/'revision-1597').glob('yunxiu-geography-*-v01.glb'))
    pinned=json.loads((ROOT/'production/native/asset-sources/boulder-01.json').read_text())
    source_binary=(ROOT/'production/native/assets/boulder-01/boulder_01.bin').read_bytes()
    expected={f['sha256'] for f in pinned['files'] if f['path'].endswith('.jpg')}
    reports=[]
    for path in paths:
        report,images,blob=load_glb(path)
        if path.parent.name.startswith('material-study-v'):
            assert expected.issubset(images),'original texture bytes changed'
            assert blob[:len(source_binary)]==source_binary,'original scan mesh buffer changed'
        reports.append(report)
    result={'schema':'yunxiu-native-assets-check/1','checks':'GLB headers, buffer bounds, accessor sizes/finiteness/normal lengths, position min/max, triangle indices, embedded input byte identity','models':reports,'khronosValidator':'not run; npm registry returned HTTP403','engineCollisionAndLOD':'not implemented or accepted','nativeRender':'mesh validation is separate from rendering; verified local Blender v02 output is recorded in evidence/local-blender-success.json'}
    (generated/'native-assets-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
