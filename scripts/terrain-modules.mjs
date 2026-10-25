import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../dist/terrain-editor/',import.meta.url)),cache=new Map();
function sourceURL(name){name=name.split('?')[0];if(cache.has(name))return cache.get(name);let s=fs.readFileSync(path.join(root,name),'utf8');s=s.replace(/from\s*(['"])(\.\/[^'"]+)\1/g,(all,quote,relative)=>'from'+quote+sourceURL(path.posix.normalize(path.posix.join(path.posix.dirname(name),relative)))+quote);let url='data:text/javascript;base64,'+Buffer.from(s).toString('base64');cache.set(name,url);return url;}
export const terrainModule=name=>import(sourceURL(name));
