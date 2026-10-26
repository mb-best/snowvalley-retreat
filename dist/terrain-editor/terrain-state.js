// A preview must await the newest requested terrain build, including a build
// requested while an older one is waiting for the next animation frame.
export function createTerrainState({getDocument,build,waitForPaint,onPending=()=>{},onReady=()=>{}}){
 let requested=0,completed=-1,pending=null,field=null;
 function rebuild(){let ticket=++requested;onPending(ticket);let task=(async()=>{await waitForPaint();if(ticket!==requested)return null;let document=getDocument(),next=await build(document);if(ticket!==requested)return null;field=next;completed=ticket;onReady(next,document,ticket);return next;})();pending=task;return task;}
 async function latest({refresh=false}={}){if(refresh||!field)rebuild();while(completed!==requested||!field){let task=pending;await task;}return field;}
 return{rebuild,latest,get revision(){return completed;},get pending(){return completed!==requested;}};
}
