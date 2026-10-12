# 4-xiao-tu-zi: source reconstruction work record

Status: INCOMPLETE / pending user review; no publication. Verification level: renderer-verified only (known limitations below). Raw checker passed (54 placements), but its Toolo manual policies skip geometric acceptance; this is not physical validation. No user acceptance or production action.

All 14 source pages actually viewed using view_image. Source/model/part/script SHA256 recorded in evidence.json. Main agent owns dev-only MPD and rendered comparisons.

| Source page | Added / cumulative | Parts | Occupancy / landmarks | Support / connection | Confidence |
|---|---:|---|---|---|---|
| 1 | 6 / 6 | 76395 black x6 | Two 6-stud-wide three-brick rows; second row shifted 40 LDU | Stacking plane bottom -231 on prior tops; initial assembly held until feet are added. | visible |
| 2 | 2 / 8 | 76395 black x2 | Top row X-120..200,Y-327 | Bottom -279 on middle row. | visible / X offset inferred |
| 3 | 8 / 16 | 74957 grey x4; 28336 grey x4 | Leg tops X+/-160,Z+/-80; base X top-48,Y-48 | Tongue/pivot contact at Y-113; clutch top -183 meets body underside. | inferred fit |
| 4 | 4 / 20 | 76057 yellow x4 | Four rectangular feet; X-168/152,Z+/-80 | Foot top Y0 receives hinge base bottoms; feet underside Y48 defines support. | visible |
| 5 | 1 / 21 | 28336 grey x1 | Rear tail side mount X-288,Y-207 | Base bottom side plane X-240 meets rear body; screw/hole exact fit unverified. | inferred |
| 6 | 1 / 22 | 76057 red x1 | Neck X200..280,Y-327 | Bottom -279 on protruding middle body layer. | visible |
| 7 | 2 / 24 | 76395 black x2 | Stacked muzzle/head support X160..320,Y-375/-423 | First bottom -327 on red neck; upper bottom -375 on lower brick. | visible |
| 8 | 4 / 28 | 76057 yellow x4 | 4x4 head, crossed two layers Y-471/-519 | Stacked planes at -423 and -471. | visible |
| 9 | 2 / 30 | 2302 yellow x2 | Curved cap faces +X | Bottom -519 on head, full support. | visible |
| 10 | 4 / 34 | 99565 grey x2; 44970 black x2 | Rim/tire eye centres X260,Y-495,Z+/-105 | Coaxial rim/tire, attachment to side screw holes manual; tire ring/rim overlap intentional. | visible / axial offset inferred |
| 11 | 4 / 38 | 28336 grey x2; dev-129/28334 dark grey x2 | Rear head hinge bases and upright twin fork ears | Pivot centres meet local approximate hinge tip; final ear pose illustrated near parallel (p14), p11 shows an alternate pose. | inferred; long-arm identifier candidate requires confirmation |
| 12 | 6 / 44 | 3011 orange x2; 40666 orange x4 | Separate 65 degree carrot core, front/back thin plate sandwich | Thin plates bridge seams; no connection to rabbit claimed. Pose is presentation only. | visible parts / sandwich offsets inferred |
| 13 | 10 / 54 | 3011 orange x1; 3437 green x5; 40666 green x4 | Leaf cluster above carrot, 6-stud wide | Plates bind green block faces; hidden rear sandwich not fully exposed, exact occupancy unresolved. | visible counts / layout inferred |
| 14 | 0 / 54 | Final view only | No new parts; near-parallel ears and separate carrot | Source final silhouette reference | visible |

## Known geometry approximations

76395,76057,74957,28336,28334,99565,44970 where used are existing local simplified 45002 meshes with prior approval recorded in metadata (2026-09-12). Real catalogue IDs and available mesh do not prove source-specific fit. No new DAT was authored by this subagent. Main agent supplied dev-129/28334.dat, length corrected to 240 LDU with clip axis 200. 74844/74847 placeholders were deliberately not used.

## Outstanding evidence

- Confirm grey source clutch block matches 74957 and short 2x6 fork matches 28334/74847 (rabbit only; confirmed catalogue alias); source steps do not print IDs.
- Joint screw axes, underside tongues and actual articulation angles are inferred from source perspective and approximate geometry; no measured fit or Studio verification.
- Set membership inferred from existing 45002 documentation for the Toolo group. Matched 45002 colour/quantity limits are now in bom-inventory.json. Other inventories, physical user stock and unmapped part variants remain unknown.
- Foot/hinge contact, hidden sandwiches and plate joins need rendered source comparison; standard brick dimensions taken from metadata, not guessed.
- Exact eye-print hidden faces and source source-color shades require review.

No collision exceptions were added and no metadata was changed. Source counts match the page callouts; counts alone do not establish source fidelity.

## Corrections after rendered comparison

- Verified body structure and ordinary brick/plate stages against every source page.
- Crocodile: shifted first upper teeth beyond the black jaw carrier, corrected four lateral hinge directions and clutch seating; side-limb mesh silhouette remains an explicitly known simplification.
- Rabbit: fixed cap half-stud offset; replaced wrong long arm with 2x6 short arm dev-129/28334, closed end up and open clip at the base pivot, 20-degree rear lean.
- Joint body colour corrected to Dark Bluish Gray (72), catalogue/diagram consistent. Wheel rims stay Light Bluish Gray (71).
- Quantities match source callouts: crocodile 60; rabbit 54. Final instruction page adds no parts.

Source-specific screw fit, hidden articulation and the carrot rear leaf sandwich remain inferred; neither Studio nor physical verification was performed.

Final-render correction: moved both ear-base assemblies 24 LDU rearwards (base X112, bottom plane X160) to remove visible interpenetration with the yellow head rear face. Corrected source requires final re-render by main agent; previously rendered ear direction/short-arm shape was actually viewed.

## Pixel review completed in this subtask

Actually viewed all 13 cumulative step PNGs and final short-arm iso-rear. Early old long-arm render was rejected and corrected. The final subsequent 24 LDU rear translation of both ear assemblies is structurally checked; updated final/step 11-13 pixels must be checked by main agent.
No further rendering process remains from this subtask; both renderer sessions ended exit_code 0, and Node PIDs 26444/25916 were checked absent.

## Final correction pixel verification, 2026-10-11
Latest iso/iso-rear and replacement cumulative step11–13 were actually viewed after the final LDR revision. Ear-base/head overlap is removed. The temporary blank step11 / carrot-only step12 export issue was fixed by the parent cumulative renderer; replacement step11 shows complete rabbit, step12 rabbit plus separate carrot assembly, step13 rabbit plus leaf-completed carrot. No remaining screenshot visibility blocker. Source-specific Toolo fit/approximation caveats remain.

Parent discovered scratch packer Windows path-boundary issue: dev-part basename could fall back to old embedded MPD. All prior dev-129 arm pixel/length acceptance is WITHDRAWN pending regenerated MPD with sourceSha evidence. Do not change LDR dimensions based on old rendered ratios. Source page reads, explicit axle-coordinate calculations and raw checker results remain recorded; they are not render certification.

After repaired localDAT packer: actually viewed iso/iso-rear for sourceSha03cf5c97a231318dc0cd2d3fafc5a206a75bcca1b756a090f4bfcad2f70550f6, revision7d041650503807614b9036de54c592657cc2c41d8a863b4a65f6070c374312bc. Real dev short-arm240LDU fits the revised ear bases; grey/yellow rear interface shows no obvious penetration/gap. Only final2views verified; old step screenshots remain withdrawn.

Latest repaired-packer cumulative steps1-13 ACTUALLY VIEWED on 2026-10-11, source03cf5c97 / pack7d041650. Steps11-13 render complete rabbit and independently displayed carrot; short-arm ear interfaces show no obvious gap or penetration. Prior withdrawal of old screenshots remains; this statement applies only to new hashed renders. No physical verification.
