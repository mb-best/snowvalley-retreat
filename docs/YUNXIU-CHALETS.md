# Yunxiu alpine chalet assets

`dist/yunxiu/chalets.js` provides original procedural Swiss alpine building assets. It reuses the existing Sunny Valley aged wood, weathered plaster and mineral/moss stone materials. It does not alter the terrain or game state, use external unlicensed geometry, or perform network requests of its own.

```js
import {createChalet} from './chalets.js';
const {group,footprint,entry,floorHeight}=createChalet({
  seed:23,width:14,depth:11,lodge:true,
  groundCorners:[-2,-3,-5,-4]
});
scene.add(group);
group.position.set(worldX,entranceGroundHeight,worldZ);
group.rotation.y=desiredFacing;
```

All dimensions are metres. The main ground floor is local `y=0`; the facade faces local `+Z`. `groundCorners` are the northwest, northeast, southeast and southwest terrain heights relative to the selected ground-floor level. Supply nonpositive values, normally by placing the main floor at the highest footprint corner. The stone basement extends to these terrain levels. It is best to select moderate slopes for house placement; very tall uninhabited foundations should not be used to compensate for cliff sites.

`footprint` gives conservative horizontal half extents and top height for placement/collision. It includes the overhangs, balcony, entrance steps, and lodge terrace. `entry` is in front of that extent, not inside the house collider. `floorHeight` is always zero. `group.userData` includes triangle count, draw-call count, chimney outlet, dimensions, terrain corner inputs and actual model-space bounds.

The building contains a stone/cream-plaster lower storey, recessed horizontal upper weatherboards, enclosed gables/loft window, pitched shingle roof with ridge caps, projecting eaves and exposed purlins, a supported front balcony, individual balusters, shutters and window mullions, curtain strips, geranium-style window/rail flower boxes, entrance canopy/steps/lantern, capped chimney, gutters/downpipes, barrel and firewood. Lodge variants add a public side terrace with picnic table and benches. Roof and shutter palettes vary deterministically with the seed.

All static parts are merged by material into 13 meshes per building. A normal 11x9 m chalet is approximately 14,000 triangles; a 14x11 m lodge is approximately 21,300 triangles. Use distance culling or proxies outside a settlement's near-detail range. Meshes cast/receive shadows; translucent-looking windows use opaque PBR glass tint to avoid sorting artifacts. Material objects are shared across deterministic variants; do not dispose their materials when unloading one building. Dispose only its geometries, or dispose shared materials once at complete world teardown. Surface names are available in `material.userData.chaletSurface` for later day/night tuning.

Validation performed with the project's actual Three.js r160 module: three sizes including a five-metre downhill foundation, finite positions, computed bounds, valid geometry attributes, and at most 13 draw calls. No rendered browser inspection was available in the asset task.
