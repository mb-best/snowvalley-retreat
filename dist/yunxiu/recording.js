export const MP4_TYPES=['video/mp4;codecs=avc1','video/mp4;codecs=avc1.640033','video/mp4'];
export function mp4Type(Recorder=globalThis.MediaRecorder){return typeof Recorder?.isTypeSupported==='function'?MP4_TYPES.find(t=>Recorder.isTypeSupported(t))||null:null;}
export async function isMP4(blob){const bytes=new Uint8Array(await blob.slice(0,64).arrayBuffer());return bytes.length>=12&&String.fromCharCode(...bytes.slice(4,8))==='ftyp';}

// Capture the WebGL canvas itself: no browser chrome, DOM HUD, desktop,
// microphone, camera or other application is ever a recording source.
export class GameRecorder{
 constructor(canvas,{onStatus=()=>{},onState=()=>{}}={}){this.canvas=canvas;this.onStatus=onStatus;this.onState=onState;this.active=false;this.pending=false;this.blob=null;this.writerHandle=null;}
 get supported(){return!!this.canvas.captureStream&&!!mp4Type();}
 async pickFile(){return globalThis.showSaveFilePicker({suggestedName:'云岫山境-'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4',types:[{description:'MP4 游戏录像',accept:{'video/mp4':['.mp4']}}],excludeAcceptAllOption:true});}
 async start(chooseLocation=true){
  if(this.active||this.pending)return;const mimeType=mp4Type();if(!this.canvas.captureStream||!mimeType)throw Error('当前浏览器未提供 MP4 画布录制。请用支持此格式的桌面浏览器打开游戏。');
  this.pending=true;this.onState('preparing');
  try{this.writerHandle=null;if(chooseLocation&&typeof globalThis.showSaveFilePicker==='function'){try{this.writerHandle=await this.pickFile();}catch(e){if(!['SecurityError','NotSupportedError'].includes(e.name))throw e;this.onStatus('当前页面不提供目录选择，录制结束后可以下载 MP4。');}}const stream=this.canvas.captureStream(30);this.stream=stream;this.chunks=[];this.bytes=0;this.blob=null;const rec=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8000000});this.recorder=rec;
   rec.ondataavailable=e=>{if(e.data?.size){this.chunks.push(e.data);this.bytes+=e.data.size;if(this.bytes>512*1024*1024&&this.active){this.onStatus('录像已达 512 MB，正在保存本段。');this.stop();}}};
   rec.onerror=e=>{this.onStatus('录像编码失败：'+(e.error?.message||'当前设备资源不足'));this.stop();};
   rec.onstop=()=>{void this.finish(rec.mimeType||mimeType);};rec.start(1000);this.active=true;this.started=performance.now();this.onStatus('正在录制游戏画面 · MP4 · 30 fps');this.onState('recording');
  }catch(error){this.stream?.getTracks().forEach(t=>t.stop());this.onState('idle');if(error.name!=='AbortError')throw error;}finally{this.pending=false;}
 }
 stop(){if(this.active){this.active=false;this.pending=true;this.onState('saving');if(this.recorder.state!=='inactive')this.recorder.stop();}}
 async finish(mimeType){this.stream?.getTracks().forEach(t=>t.stop());try{const blob=new Blob(this.chunks,{type:mimeType});this.chunks=[];if(!await isMP4(blob))throw Error('编码器未生成有效 MP4 容器，本段未伪装成 MP4 保存。');this.blob=blob;
   if(this.writerHandle){const writer=await this.writerHandle.createWritable();try{await writer.write(blob);await writer.close();}catch(e){await writer.abort?.();throw e;}this.onStatus('MP4 已保存到你选择的位置。');}
   else this.onStatus('录像已完成，点击“保存 MP4”下载。浏览器未提供文件选择器时，保存目录由浏览器下载设置决定。');
   this.onState('ready');
  }catch(e){this.onStatus(e.message||'录像保存失败，可重试另存。');this.onState(this.blob?'ready':'idle');}finally{this.pending=false;}}
 async saveAs(){if(!this.blob)return;try{if(typeof globalThis.showSaveFilePicker==='function'){const handle=await this.pickFile(),writer=await handle.createWritable();try{await writer.write(this.blob);await writer.close();}catch(e){await writer.abort?.();throw e;}this.onStatus('MP4 已另存到指定位置。');}else{const url=URL.createObjectURL(this.blob),a=document.createElement('a');a.href=url;a.download='云岫山境-'+Date.now()+'.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);this.onStatus('已交给浏览器保存 MP4。');}}catch(e){if(e.name!=='AbortError')this.onStatus('另存失败：'+e.message);}}
}
