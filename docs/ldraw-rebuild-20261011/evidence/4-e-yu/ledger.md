# 4-e-yu: source reconstruction work record

Status: INCOMPLETE / pending user review; no publication. Verification level: renderer-verified only (known limitations below). Raw checker passed (60 placements), but its Toolo manual policies skip geometric acceptance; this is not physical validation. No user acceptance or production action.

All 11 source pages actually viewed using view_image. Source/model/part/script SHA256 recorded in evidence.json. Main agent owns dev-only MPD and rendered comparisons.

| Source page | Added / cumulative | Parts | Occupancy / landmarks | Support / connection | Confidence |
|---|---:|---|---|---|---|
| 1 | 5 / 5 | 4196 green x2; 76395 black x3 | 6-stud-wide body on two 6x12 plates; black covers X -200..280 | Black brick bottom Y0 contacts green plate top Y0; neighbouring plates joined by carrier crossing X240. | visible / placement inferred |
| 2 | 7 / 12 | 10199 green x1; 3011 green x4; 2302 green x2 | 4-stud tail narrows body; lower tail extent X -640..-200 | Tail plate X -560..-240; green bricks bridge tail/body seam. Curved tips only partially supported. | visible / tail reach inferred |
| 3 | 8 / 20 | 28336 grey x4; 74957 grey x4 | Four limbs at X -160/240, side Z +/-168; end blocks at Z +/-303 | Clutch tongue to hinge pivot nominal alignment from existing approximate mesh; body side screw fixation manual. | inferred: exact fit unresolved |
| 4 | 4 / 24 | 28336 grey x2; 74957 grey x2 | Lift bases X280,Z+/-80; clutch tops X232,Y-183 | Clutch lower tongues meet estimated pivot Y-113. Exact friction/screw mechanism unverified. | inferred |
| 5 | 1 / 25 | 76395 black x1 | Upper jaw carrier X200..360,Y-231 | Bottom Y-183 on clutch tops, partial footprint support. | visible / fit inferred |
| 6 | 4 / 29 | 4196 green x1; 3437pe1 yellow x2; 3437 green x1 | Upper mouth X240..720, eye line X280 across Z | Upper plate bottom Y-231 on carrier; eye bottoms Y-255 on plate. Print variant has two faces; hidden face not proved by source. | visible / print variant inferred |
| 7 | 2 / 31 | 40666 red x2 | Tongue X320..640,Z+/-40,Y-24 | Bottom Y0 on lower mouth plate. | visible |
| 8 | 12 / 43 | 3437 white x12 | Six lower teeth X360/520/680, six upper X440/560/680, Z+/-80 | Lower bottoms Y0; upper top studs meet upper plate underside Y-231; source only partly exposes rear upper teeth. | visible count / exact longitudinal offset inferred |
| 9 | 11 / 54 | 3011 green x10; 2302 green x1 | Body cover six bricks X-200..120,Z-120..120; tail four bricks | Bottom Y-48 atop prior green and Toolo body; central curved tip on earlier curved pair. | visible count / stud occupancy inferred |
| 10 | 6 / 60 | 40666 lime x6 | Central tail stripe and 6-stud-wide back patch | Bottom Y-96 on green cover. | visible |
| 11 | 0 / 60 | Final view only | No new placements | Source final silhouette reference | visible |

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

## Pixel review completed in this subtask

Actually viewed all 10 cumulative step PNGs and final iso/iso-rear. Main structures and step additions correspond to source; side limbs/clutch shape remain known approximate geometry. Final color-only correction was rerendered with no error logs.
No further rendering process remains from this subtask; both renderer sessions ended exit_code 0, and Node PIDs 26444/25916 were checked absent.

Parent discovered scratch packer Windows path-boundary issue: dev-part basename could fall back to old embedded MPD. All prior dev-129 arm pixel/length acceptance is WITHDRAWN pending regenerated MPD with sourceSha evidence. Do not change LDR dimensions based on old rendered ratios. Source page reads, explicit axle-coordinate calculations and raw checker results remain recorded; they are not render certification.
Latest repaired-packer cumulative steps1-10 ACTUALLY VIEWED individually, sourcebb2b3a7c85d16a1ce64ab046eda3f450dc002a40e5b14e6cb11336d261864c1d, pack9e7cc1055e330823c51da709276649636d2e693ed13837e7df69baa7f8a59eac. All additions visible, no blank steps. Jaw supports/tongue/teeth/back/tail visible, limb hinge and clutch meshes remain approximate and hidden screw fit unresolved. Old final views not reused; latest final queue pending.
After static-render correction, latest final iso/iso-rear/top review-sheet-final.jpg ACTUALLY VIEWED. All three are nonblank and display complete jaw/tail/legs; this is sheet-scale pixel screening, parent separately inspected full-resolution iso. Hidden Toolo fit caveats remain.
