# Wings and wheels recognition review — 2026-10-15

This is a local scratch record only; it is not a publication or acceptance record.

## Photo evidence

- 45117c01 multi-angle product views: [DECOTOYS a](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Wings-with-Beam-Center-45117c01-Blue-a.jpg), [b](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Wings-with-Beam-Center-45117c01-Blue-b.jpg), [c](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Wings-with-Beam-Center-45117c01-Blue-c.jpg).
- 31239c01 rear spoiler view: [DECOTOYS b](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Rear-Spoiler-31239c01-Blue-b.jpg).
- 44970 identity/size: [Brickset inventory](https://brickset.com/inventories/6143-1/unique/rebrickable) identifies it as the Duplo off-road tyre, diameter 46; no reliable multi-angle product photo was found in this pass.
- 99565 identity/compatibility: [BrickLink 99565c01](https://www.bricklink.com/v2/catalog/catalogitem.page?P=99565c01&idColor=86) identifies the short-screw wheel and compatible tyre families; the multi-angle photo below was subsequently located.
- 99565 actual multi-angle image: [BrickLink image](https://img.bricklink.com/ItemImage/PN/86/99565c01.png). The side view shows three stepped rim bands and the front view shows an open radial web with a raised central screw boss.

## Before/after comparison

The existing wing and tail candidate geometry was retained after visual comparison because it already expresses the photo-specific cues: paired swept skins and tip lips on 45117c01; two separated arched supports, open center, and continuous curved top foil on `tail-body.dat`. The only source edits are explanatory `!HELP` lines; mount axes, receiving positions, and meshes are unchanged.

| file | geometry before | geometry after | decision |
| --- | --- | --- | --- |
| `dev-toolo/45117c01.dat` | bbox X -202..202, Y -120..40, Z 1..49 | same | retain; photo cues present |
| `dev-toolo/engaged/45117c01.dat` | same wing mesh, alternate screw phase | same | retain; state-only wrapper |
| `dev-toolo/tail-body.dat` | bbox X 0..146, Y -24..91, Z -84..84 | same | retain; photo cues present |
| `parts/44970.dat` | round 46 mm nominal tyre envelope | same | retain; tread evidence insufficient |
| `parts/dev-toolo/wheel-body.dat` | radial web, end lips, smooth middle barrel | same envelope plus photo-matched middle bead | changed; screw/receiver geometry retained |

The 99565 housing was then compared against the BrickLink image and locally rendered before/after. The existing housing had the radial web and end lips but lacked the distinct middle strengthening band. `dev-toolo/wheel-body.dat` now adds a shallow 32-segment bead between Y=-3..5, within the existing R42/Y envelope; all screw and receiver files remain untouched. Render outputs: `wheel-pair-iso.png` (before) and `wheel-pair-after-iso.png` (after).

## Local validation

- `node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs scripts/ldraw-models/4-da-xiang.ldr`: passed, 50 placements.
- `node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs .tmp/recognizable-parts/wings-wheels/wheel-pair.ldr`: passed, 2 placements.
- `node .agents/skills/image-to-ldraw/scripts/preview-model.mjs .tmp/recognizable-parts/wings-wheels/wheel-pair.ldr ...`: rendered before/after iso views successfully; only expected color-14/71 material warnings.
- The elephant model is the direct downstream consumer of 45117c01; other direct course references are listed by `rg` in the parent task log. No course LDR was edited here.

## Local photo hashes

Downloaded scratch images are retained beside this record. SHA-256: `45117-a.jpg` `ffd495f0ede44a8d0e2811350832d938ca8562f021d322b4d630571082c886bf`; `45117-b.jpg` `226d7492bab3445ff8557a263d8ede9656ddc05cb70616f042d92079b4561730`; `31239-b.jpg` `29733b946cfed2784cffd9de4c6ecd2808a872fddedb46615b83b53369645129`.

Independent review found and corrected the 96 new quad winding directions; all exterior normals now point radially outward. Screw and receiver coordinates remain unchanged.

## Integration rejection
The added bead intersects the existing44970inner wall:256new triangle-pair crossings per tyre. The complete96quad addition was reverted. Current wheel-body.dat exactly matches the pre-turn file hash. The before/after images show a rejected proposal, not an adopted repair. No speculative inner tyre groove was introduced.
