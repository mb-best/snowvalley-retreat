// A published-copy workspace must never share its active IndexedDB record or
// migration markers with the user's original editing workspace.
export function draftScope(publishedCopy=false,version='published-summits-1'){
 const current=version==='published-map-1474',name=version==='published-map-1597'?'published-map-1597':current?'published-map-1474':'published-summits-1',suffix=publishedCopy?'-'+name:'';
 return{store:'snowvalley-terrain-draft-v2'+suffix,activeKey:'active-terrain'+suffix,source:publishedCopy?'./'+name+'.json?v=1':'./default-terrain.json?v=summits-1',backupPrefix:publishedCopy?name+':':'',...(publishedCopy&&current?{beforeSummits:'./terrain-editor/before-map-1474.json',beforeRegions:'./terrain-editor/before-map-1474-regions.json'}:{})};
}
