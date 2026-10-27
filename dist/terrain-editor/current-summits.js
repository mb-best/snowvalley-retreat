// This entry always uses the original editor's storage, never the isolated
// published-copy workspace. An unreadable original must not become a new map.
export async function loadCurveDraft({readStored,readActive,readBaseline,validate}){
 let raw=await readStored(),source=raw===null?'published-curves':'browser',document;
 if(raw===null)document=validate(await readBaseline());
 else{
  if(JSON.parse(raw).storage==='indexeddb')raw=await readActive();
  if(!raw)throw Error('原步道地图的保存记录无法读取');
  document=validate(JSON.parse(raw));
 }
 if(!document.trailCurveVersion)throw Error('当前保存的地图不是步道曲线编辑版');
 return{document,source};
}

export async function prepareCurrentSummitRepair(document,{repair,saveBackup}){
 if(document.summitRepairVersion>=1)return null;
 const original=JSON.stringify(document),result=repair(document);
 if(!result)throw Error('未生成两峰修补结果，原稿已保留');
 // A unique backup key is supplied by the caller. Old backups remain intact.
 await saveBackup(original);
 return result;
}
