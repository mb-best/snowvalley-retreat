"""Stage verified local source data and authored samples without running UE5."""
import hashlib
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
NATIVE=ROOT/'production/native'
PROJECT=Path(__file__).parent/'YunxiuNative'

def main():
 bundle=NATIVE/'generated/revision-1597'
 manifest=json.loads((bundle/'manifest.json').read_text())
 assert manifest['source']['sha256']=='cf6959526d1ce86c1acaed4ac1743f38ba697a26260ce82396389c90b4c5f757'
 assert (bundle/'study-context.f32').stat().st_size==201*201*4
 sources=[bundle/'study-context.f32',bundle/'study.json',bundle/'manifest.json']
 samples=NATIVE/'generated/ecosystem-v01'
 study=json.loads((samples/'manifest.json').read_text())
 for record in study['assets']:
  path=samples/record['file']
  assert hashlib.sha256(path.read_bytes()).hexdigest()==record['sha256']
  sources.append(path)
 sources.append(samples/'axis-calibration-v01.glb')
 vegetation=NATIVE/'generated/vegetation-v02'
 vegetation_records=[]
 if (vegetation/'manifest.json').exists():
  vegetation_records=json.loads((vegetation/'manifest.json').read_text())['assets']
  for record in vegetation_records:
   path=vegetation/record['file']
   if hashlib.sha256(path.read_bytes()).hexdigest()!=record['sha256']:
    raise ValueError('Vegetation source hash mismatch: '+str(path))
   sources.append(path)
 target=PROJECT/'Content/NativeSource';target.mkdir(parents=True,exist_ok=True)
 records=[]
 for source in sources:
  destination=target/source.name
  if destination.exists() and destination.read_bytes()!=source.read_bytes():
   raise FileExistsError('Staged source changed; choose a fresh project copy rather than overwrite: '+str(destination))
  shutil.copyfile(source,destination)
  records.append({'file':source.name,'bytes':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()})
 result={'schema':'yunxiu-unreal-source-staging/1','sourceRevision':1597,'sourceMapSha256':manifest['source']['sha256'],'terrainStatus':'201x201 5m hydrology-aware context reference, not added real geological detail or a full-world Landscape acceptance','localOriginEastSouthMetres':[1150,-3200],'baseAltitudeMetres':1700,'files':records,'vegetationAssets':vegetation_records,'engineExecuted':False,'cppCompiled':False,'readyForRuntimeAcceptance':False}
 (target/'staging-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
 (NATIVE/'evidence/unreal-source-staging.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
