"""Archive every tracked file and an independently restorable full Git history."""
import argparse,hashlib,json,subprocess,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();output=a.output.resolve();output.parent.mkdir(parents=True,exist_ok=True)
 if git('status','--porcelain').strip():raise SystemExit('Commit migration changes before packaging an exact restorable version.')
 sha=git('rev-parse','HEAD').decode().strip();paths=git('ls-files','-z').decode().split('\0');paths=[x for x in paths if x]
 with tempfile.TemporaryDirectory(prefix='snowvalley-migration-') as temp:
  temp=Path(temp);bundle=temp/'snowvalley-history.bundle';subprocess.run(['git','bundle','create',str(bundle),'--all'],cwd=ROOT,check=True,capture_output=True);subprocess.run(['git','bundle','verify',str(bundle)],cwd=ROOT,check=True,capture_output=True)
  metadata={'schema':'snowvalley-migration/1','commit':sha,'commits':int(git('rev-list','--count','HEAD')),'bundleSha256':digest(bundle),'files':[{'path':x,'bytes':(ROOT/x).stat().st_size,'sha256':digest(ROOT/x)} for x in paths]}
  with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for name in paths:z.write(ROOT/name,'snowvalley/'+name)
   z.write(bundle,'snowvalley-history.bundle');z.writestr('MIGRATION-MANIFEST.json',json.dumps(metadata,ensure_ascii=False,indent=2));z.writestr('RESTORE.txt','Full files are in snowvalley/. Restore complete Git history with:\ngit clone snowvalley-history.bundle restored-snowvalley\nThe bundle includes all branches/commits from the migration checkout.\nBrowser progress must be exported separately using save-transfer.html.\n')
  with zipfile.ZipFile(output) as z:
   if z.testzip():raise SystemExit('Archive integrity check failed')
 print(json.dumps({'archive':str(output),'commit':sha,'commits':metadata['commits'],'files':len(paths),'bytes':output.stat().st_size,'sha256':digest(output)},ensure_ascii=False))
if __name__=='__main__':main()
