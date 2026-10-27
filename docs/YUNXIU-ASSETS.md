# Yunxiu world asset provenance

Downloaded on 2026-10-28. Files are self-hosted; the game does not depend on a third-party download at runtime.

## Delivered model assets

- Kenney **Nature Kit 2.1**, source <https://kenney.nl/assets/nature-kit>, **CC0-1.0**. The original ZIP came from the Download link on that official page. The included `KENNEY-NATURE-LICENSE.txt` is unchanged from that archive. Thirty-nine selected GLB models cover four pine silhouettes, four broadleaf silhouettes, three bushes, three grasses, nine flower variations, rocks, a stump, a log, mushrooms, two bridges, a fence, a campfire and a sign.
- Kenney **Mini Characters 1.0**, source <https://kenney.nl/assets/mini-characters>, **CC0-1.0**. Included `KENNEY-MINI-LICENSE.txt` unchanged from the official ZIP. `character-male.glb` and `character-female.glb` retain the original geometry, two skins and 32 animation clips. Their external palette PNG was embedded into each GLB for a one-request load. No other retargeting or conversion was performed.
- Full per-file provenance, sizes, animation names and SHA-256 hashes are in `dist/yunxiu/assets/model-manifest.json`. The 41 models total 938,860 bytes. They have no external texture/buffer dependencies.

### Character coordinate and animation details

Both character files are Y-up and face +Z. Rest-pose dimensions were checked with the matching Three.js r160 GLTFLoader and Box3 after updating skeleton matrices, not inferred from filename. Male size is `[0.7671682463, 0.6713248832, 0.3399998546]`; its feet are effectively y=0. Female size is `[1.0987870321, 0.7755282862, 0.4995303005]`. Normalize actual Box3 height to the intended player height (male about 2.60679 scale for 1.75 m). Turn the model container around Y to follow the movement heading. For cloned skinned avatars use SkeletonUtils cloning, or load independent GLTF instances, rather than Object3D.clone on a shared skeleton.

Exact clip names, case-sensitive: `static`, `idle`, `walk`, `sprint`, `jump`, `fall`, `crouch`, `sit`, `drive`, `die`, `pick-up`, `emote-yes`, `emote-no`, `holding-right`, `holding-left`, `holding-both`, `holding-right-shoot`, `holding-left-shoot`, `holding-both-shoot`, `attack-melee-right`, `attack-melee-left`, `attack-kick-right`, `attack-kick-left`, `interact-right`, `interact-left`, `wheelchair-sit`, `wheelchair-look-left`, `wheelchair-look-right`, `wheelchair-move-forward`, `wheelchair-move-back`, `wheelchair-move-left`, `wheelchair-move-right`.

For locomotion use `idle` (1.3333 s), `walk` (0.6667 s) and `sprint` (0.5 s), crossfaded via AnimationMixer; jump is 0.5 s and fall is 0.3333 s. These are stylized mini-character meshes, not scanned humans.

## Delivered PBR material

**Mossy Rock**, Rob Tuytel / Poly Haven: <https://polyhaven.com/a/mossy_rock>. **CC0-1.0**, official blanket asset licence <https://polyhaven.com/license>. Download metadata came from the official API (`https://api.polyhaven.com/files/mossy_rock`); retain the voluntary/API credit **Powered by Poly Haven** in credits.

- `mossy-rock-color.jpg`: 1024², 1,124,438 bytes; sRGB color.
- `mossy-rock-normal.jpg`: 1024², 995,727 bytes; OpenGL tangent normal, linear color space.
- `mossy-rock-roughness.jpg`: 1024², 780,918 bytes; linear roughness.

Use repeat wrapping and metre-scaled UVs/triplanar projection. Set color texture to SRGBColorSpace, normal/roughness to NoColorSpace. These are actual photographed/scanned PBR material assets, not preview screenshots. Source URL and SHA-256 are in `pbr-manifest.json`; `POLY-HAVEN-LICENSE.txt` records the licence.

## Three.js loader dependency

Existing `dist/vendor/three.module.js` declares REVISION `160`. Downloaded matching official sources from tag **r160**:

- <https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/loaders/GLTFLoader.js> → `dist/vendor/addons/loaders/GLTFLoader.js`
- <https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/jsm/utils/BufferGeometryUtils.js> → `dist/vendor/addons/utils/BufferGeometryUtils.js`

MIT; `THREE-ADDONS-LICENSE.txt` preserves the repository's existing Three.js MIT notice. The only change is replacing bare `from 'three'` with `from '../../three.module.js'`. The loader's only relative static import is BufferGeometryUtils, which is included. These selected GLBs do not use Draco, Meshopt or KTX2, so no decoder downloads are needed. Both modules pass `node --check` and GLTFLoader successfully parses both character skeletons and animation sets in Node with material image loading omitted for the geometry-only check.

## Searches and assets not adopted

- Quaternius Ultimate Nature / Farm Buildings are officially CC0: <https://quaternius.com/packs/ultimatenature.html>, <https://quaternius.com/packs/farmbuildings.html>. The older packs offer FBX/OBJ/Blend. Farm/barn forms do not closely match the requested detailed Swiss chalet street architecture and were not adopted merely to fill a slot.
- A matching named **Chalet** by Poly by Google exists on <https://poly.pizza/m/6ufSK2nQBc6> with a Creative Commons Attribution licence. The exact licence version was not verified; ordinary Poly Pizza HTTP download access returned 403. No asset was downloaded from it, and no protection was bypassed.
- ambientCG **Grass001** and **WoodSiding006** official pages are CC0 and expose 1K JPEG ZIP download links: <https://ambientcg.com/view?id=Grass001>, <https://ambientcg.com/view?id=WoodSiding006>. Both actual downloads redirected to HTTP 403. They are not included and must not be listed as used.
- Additional Poly Haven grass/wood/forest/stone API requests returned 403. They are not included. The successful Mossy Rock material is the only delivered Poly Haven texture set.
- Consequently, no suitable Swiss chalet mesh was actually obtained under a verified, accessible, lightweight download. A custom Swiss chalet kit with plastered stone bases, timber upper floors, deep gable eaves, shutters, balconies and flower boxes is justified for the requested quality. Existing sunny-valley EZ-Tree bark/leaf resources remain MIT with their existing notices; reuse them for more detailed near trees, and use the Kenney trees as instanced silhouettes or secondary objects rather than claiming they are photoreal scans.
