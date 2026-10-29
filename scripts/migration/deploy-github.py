"""Publish an intact Git checkout to an explicitly selected GitHub audience.
Requires GitHub CLI browser authentication. Never accepts or prints a token.
"""
import argparse,json,os,subprocess,sys,time,shlex
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def run(args,**kwargs):return subprocess.run(args,cwd=ROOT,text=True,check=True,**kwargs)
def capture(args):return run(args,capture_output=True).stdout.strip()
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--gh',default='gh');p.add_argument('--repository',default='mb-best/snowvalley-retreat');p.add_argument('--visibility',choices=['private','public'],required=True);p.add_argument('--no-wait',action='store_true');a=p.parse_args();gh=a.gh
 if subprocess.run([gh,'auth','status'],cwd=ROOT,capture_output=True).returncode:run([gh,'auth','login','--hostname','github.com','--git-protocol','https','--web','--scopes','repo,workflow'])
 owner=capture([gh,'api','user','--jq','.login']);expected=a.repository.split('/')[0]
 if owner!=expected:raise SystemExit('Authenticated GitHub account differs from selected repository owner; no write attempted.')
 if capture(['git','status','--porcelain']):raise SystemExit('Commit the reviewed migration changes first; publishing must preserve an exact commit.')
 head=capture(['git','rev-parse','HEAD']);repo=subprocess.run([gh,'api','repos/'+a.repository],cwd=ROOT,text=True,capture_output=True)
 if repo.returncode:
  # Authentication/transport errors must not be interpreted as an absent repo.
  if '404' not in repo.stderr:raise SystemExit('Unable to inspect repository: '+repo.stderr)
  run([gh,'repo','create',a.repository,'--'+a.visibility,'--description','雪隐山居 · 云岫山境：完整游戏、地图、美术资源与版本历史'])
 else:
  meta=json.loads(repo.stdout)
  if meta.get('visibility')!=a.visibility:raise SystemExit('Repository visibility differs from the explicitly selected audience; no visibility change attempted.')
 remote='https://github.com/'+a.repository+'.git'
 env=os.environ.copy();env.update({'GIT_CONFIG_COUNT':'2','GIT_CONFIG_KEY_0':'credential.helper','GIT_CONFIG_VALUE_0':'','GIT_CONFIG_KEY_1':'credential.helper','GIT_CONFIG_VALUE_1':'!'+shlex.quote(gh)+' auth git-credential','GIT_TERMINAL_PROMPT':'0'})
 refs=subprocess.run(['git','ls-remote','--heads',remote,'refs/heads/main'],cwd=ROOT,env=env,text=True,capture_output=True,check=True).stdout.strip()
 if refs:
  sha=refs.split()[0]
  if subprocess.run(['git','cat-file','-e',sha+'^{commit}'],cwd=ROOT,capture_output=True).returncode or subprocess.run(['git','merge-base','--is-ancestor',sha,head],cwd=ROOT,capture_output=True).returncode:raise SystemExit('Existing GitHub main has unrelated/newer history. Preserved it; choose an empty repository or reconcile history first.')
 run(['git','push',remote,'HEAD:refs/heads/main'],env=env)
 if capture(['git','tag','--list']):run(['git','push',remote,'--tags'],env=env)
 # Exact history is now backed up even if the account cannot enable private Pages.
 result=subprocess.run([gh,'api','repos/'+a.repository+'/pages'],cwd=ROOT,text=True,capture_output=True)
 if result.returncode:
  if '404' not in result.stderr:raise SystemExit('Source uploaded; Pages inspection failed: '+result.stderr)
  result=subprocess.run([gh,'api','--method','POST','repos/'+a.repository+'/pages','-f','build_type=workflow'],cwd=ROOT,text=True,capture_output=True)
  if result.returncode:raise SystemExit('Full source and Git history uploaded. Pages could not be enabled; private Pages requires an eligible GitHub plan. No audience change attempted.\n'+result.stderr)
 elif json.loads(result.stdout).get('build_type')!='workflow':
  run([gh,'api','--method','PUT','repos/'+a.repository+'/pages','-f','build_type=workflow'],capture_output=True)
 run([gh,'workflow','run','github-pages.yml','--repo',a.repository,'--ref','main'])
 if a.no_wait:print('Source uploaded and Pages workflow queued. Check https://github.com/'+a.repository+'/actions');return
 for _ in range(120):
  runs=json.loads(capture([gh,'run','list','--repo',a.repository,'--workflow','github-pages.yml','--branch','main','--limit','8','--json','databaseId,status,conclusion,headSha,url']))
  match=next((r for r in runs if r['headSha']==head and r['status']=='completed' and r['conclusion']=='success'),None)
  if match:
   pages=json.loads(capture([gh,'api','repos/'+a.repository+'/pages']));print(json.dumps({'repository':'https://github.com/'+a.repository,'commit':head,'pages':pages['html_url'],'workflow':match['url']},ensure_ascii=False));return
  current=[r for r in runs if r['headSha']==head]
  if current and all(r['status']=='completed' and r['conclusion'] not in ('success','cancelled') for r in current):raise SystemExit('Pages workflow failed. Source/history remain preserved. See https://github.com/'+a.repository+'/actions')
  time.sleep(5)
 raise SystemExit('Source uploaded. Publication is still pending; check GitHub Actions before calling the website live.')
if __name__=='__main__':main()
