// A preview must await the newest requested terrain build, including a build
// requested while an older one is waiting for the next animation frame.
export function createTerrainState({getDocument,build,waitForPaint,onPending=()=>{},onReady=()=>{}}){
 let requested=0,completed=-1,pending=null,field=null;
 function rebuild(){let ticket=++requested;onPending(ticket);let task=(async()=>{await waitForPaint();if(ticket!==requested)return null;let document=getDocument(),next=await build(document);if(ticket!==requested)return null;field=next;completed=ticket;onReady(next,document,ticket);return next;})();pending=task;return task;}
 async function latest({refresh=false}={}){if(refresh||!field)rebuild();while(completed!==requested||!field){let task=pending;await task;}return field;}
 return{rebuild,latest,get revision(){return completed;},get pending(){return completed!==requested;}};
}
// On reload, the in-memory last edit is gone. Locate saved contour edits from
// their retained baselines and focus the point with the largest height change.
export function changedContourFocus(document,current,heightAt){
 let best=null,score=-1;
 for(let f of document.features){if(f.type!=='contour')continue;let baseline=f.baselinePoints,edited=!baseline||f.elevation!==f.baselineElevation||f.points.length!==baseline.length||f.points.some((p,i)=>p[0]!==baseline[i][0]||p[1]!==baseline[i][1]);if(!edited)continue;
  for(let p of f.points){let delta=document.terrainBase?Math.abs(heightAt(current,...p)-heightAt(document.terrainBase,...p)):Math.abs(f.elevation-(f.baselineElevation??f.elevation));if(delta>score){score=delta;best={...f,focusPoint:[...p]};}}
 }
 return best;
}
