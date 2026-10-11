# 鱼儿的尾巴 — source draft review

Status: INCOMPLETE geometry/support review; pending user confirmation. Not renderer-verified. No physical validation.

All 10 source pages were actually viewed before the resource pause. Source identity and SHA256 are in source.json (1f52d929…be5c495). Model contains 195 placements and 9 cumulative steps. Page 10 is the final view without additions. Generator is scratch-only build.mjs; source deliverable is STEAMx/scripts/ldraw-models/5-yu-er-de-wei-ba.ldr.

## Page correspondence

- p1: paired red long holed rails and yellow upper/lower body rows. 75350 uses the complete official 6515/6516 assembly, not its bottom alone.
- p2: gray eye axle, four yellow pulley hubs and two black tyre eyes. Source holes define the shared axis.
- p3: blue/yellow tapered body rows and lower red bearing.
- p4: gray fin axle, yellow retainers and two short crank fins.
- p5: two blue curved top pieces, official 2302b orientation.
- p6: vertical green tail pivot, two red short bearings and four axial retainers.
- p7: blue tail lobes and yellow upper/lower ends. Offset and axial depth are inferred from oblique views, not measured.
- p8: two green 24x24 bases.
- p9: source callout of 110 blue 2x4 plates and 34 yellow 2x4 bricks represented exactly, forming water and border.

## Support and unresolved evidence

Ordinary stacked body and pool plates use catalog stud pitch and actual plate heights. Tail bearings share one vertical axle and the source arm positions. Exact axle retention depth, fin orientation and fish-to-base bearing contact still need close rendered review. No new unidentified part ID was substituted. Tail position is a source-based inferred pose and must not be called a mechanically proven joint.

Raw checker: FAIL, 2 error groups, both p2 tyre/pulley occupied bounding boxes. The hollow tyre cavity can explain this class of flag, but this model has not received a fresh exact-profile or pixel acceptance pass. Do not silence or call these physically validated.

No final or cumulative-step images accepted for this source version. Existing renders from the old 1.15 camera may crop boundaries and do not establish whole-model verification. Parent will render statically to D drive. bom-reference.json records all quantities and 9656 comparison; actual user inventory per color remains unknown. Reference kit is not an exclusive lesson BOM.

## D final review and correction

Actually viewed all3 original D final views and contact sheet for prior source e0f4f467, then re-opened source p10 and fin closeup p4. Entire pool is framed. Found a source mismatch: short-crank fins pointed vertically down, whereas source p4/p10 shows them tailward. Corrected both fins to a45-degree tailward static pose; angle is perspective-estimated, not measured. New raw checker still reports the same2 tyre cavity groups; all matrices remain rigid and proper. Because fin/pool profiles are not checked by the manual mechanical policy, fin-to-waterplate clearance remains an open concern, including possible intersection near the lower end. Do not call a working/supported fish based only on the checker. No cumulative-step pixel review yet.

Replacement source24e7354c/revision8208c3f8 final3 original images now actually reviewed separately. Both fins visibly angle toward the tail and the previous vertical-pose mismatch is resolved. Pool and model remain fully framed. Fin ends are close to waterplate studs: full-model pixels do not establish positive clearance or rule out a small penetration. This remains an unresolved local geometry issue, not a passed contact check. current-pixel-review.json now binds the revised image hashes with this explicit limitation. Source unchanged after this inspection; no physical or user acceptance.
