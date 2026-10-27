// A published-copy workspace must never share its active IndexedDB record or
// migration markers with the user's original editing workspace.
export function draftScope(publishedCopy=false){
 const suffix=publishedCopy?'-published-summits-1':'';
 return{store:'snowvalley-terrain-draft-v2'+suffix,activeKey:'active-terrain'+suffix,source:publishedCopy?'./published-summits-1.json?v=1':'./default-terrain.json?v=summits-1',backupPrefix:publishedCopy?'published-summits-1:':''};
}
