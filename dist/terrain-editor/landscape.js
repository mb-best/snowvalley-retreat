import{clone,fieldFor,elevationAt}from'./model.js?v=6';
import{developHydrology,settleBasins,finalizeWater,storeTerrain,profile}from'./landscape-hydrology.js?v=1';
import{developEcology}from'./landscape-ecology.js?v=1';
import{addEstates,developTrails}from'./landscape-trails.js?v=2';
export function developLandscape(doc){
 if(doc.landscapeVersion>=1)return false;
 let sourceRevision=doc.revision,{field,reports}=developHydrology(doc),basins=settleBasins(doc,field);field=finalizeWater(doc,field);storeTerrain(doc,field);field=fieldFor(doc.features,401,321,500,doc.terrainBase);addEstates(doc,field);let ecology=developEcology(doc,field),trails=developTrails(doc,field);
 for(let r of reports){let f=doc.features.find(f=>f.id===r.id);r.after=profile(field,f.points,.002);}
 doc.landscapeVersion=1;doc.revision=(Number(doc.revision)||0)+1;doc.updatedAt=new Date().toISOString();doc.landscapeDesign={sourceRevision,water:{preservedRiverIds:reports.map(r=>r.id),reports,basinGroups:basins.groups,addedLakes:basins.added,waterfalls:doc.features.filter(f=>f.type==='waterfall').map(f=>({id:f.id,drop:f.drop,lipElevation:elevationAt(field,...f.points[0]),toeElevation:elevationAt(field,...f.points[1])}))},ecology:{...ecology,latitude:32,forestMax:3500,meadowMax:4000},trails:{targets:trails.targetCount,lengthKm:trails.lengthKm},references:['https://gml.noaa.gov/grad/solcalc/solareqns.PDF','https://www.fs.usda.gov/Internet/FSE_DOCUMENTS/stelprd3798303.pdf','https://www.fs.usda.gov/t-d/pubs/htmlpubs/htm07232806/page08.htm','https://www.parks.ca.gov/pages/1324/files/Chapter%205%20-%20Principles%20of%20Trail%20Layout%20and%20Design.FINAL.04.03.19.pdf']};
 doc.notes+=' 山水生态修订：保留全部河流流程并局部整修河床与等高线；主要闭合洼地形成湖盆；新增听雪瀑106m、藏月瀑85m、听松山庄及晴岚山庄。步道按坡度和水体寻路；植被按北纬32°日照、坡向、遮阴、海拔、坡度和相对湿度形成连续过渡。此为虚构地形设计，非实测生态或工程数据。';return true;
}
