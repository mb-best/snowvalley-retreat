(async()=>{
const PREFIXES=['snowvalley-','yunxiu-'];
const allowedKey=k=>typeof k==='string'&&PREFIXES.some(p=>k.startsWith(p));
const DB='snowvalley-terrain-backups';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=tx=>new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('数据库事务中止'));});
async function openDB(){const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('drafts'))r.result.createObjectStore('drafts');};return request(r);}
async function exportBackup(){const entries=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(allowedKey(key))entries.push({key,value:localStorage.getItem(key)});}const db=await openDB();try{const tx=db.transaction('drafts','readonly'),completed=done(tx),store=tx.objectStore('drafts'),keysRequest=request(store.getAllKeys()),valuesRequest=request(store.getAll()),[keys,values]=await Promise.all([keysRequest,valuesRequest]);await completed;return{schema:'snowvalley-browser-backup/1',exportedAt:new Date().toISOString(),sourceOrigin:location.origin,localStorage:entries,drafts:keys.map((key,i)=>({key,value:values[i]}))};}finally{db.close();}}

const data=await exportBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='snowvalley-browser-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);console.info('已导出雪隐山居存档与地形草稿',data.localStorage.length,data.drafts.length);
})().catch(error=>console.error('雪隐山居导出失败',error.message));
