# 4-du-jiao-xian

All 12 source pages actually viewed after SHA256 verification: 11db2740e2f5d1e5b0cb002f777ef700e1ac1d2dbbe127fabf506dbb00b31919.
Model SHA256: 315062621f6838fd246d5fce94debb509319f0cefa1e1debb4ebe1a983b12a2f

- Page1: Five black Toolo body bricks.
- Page2: Six side-built hinge bases,3 per side.
- Page3: Six short arms,200LDU axle spans, feet toY0.
- Page4: Two grey side-built2x4 front bricks and one upper hinge.
- Page5: One400LDU long horn plusclutch; two blue claws omitted.
- Page6: Two rim+tyre eyes mounted frontside holes.
- Page7: Two turntables, two upright hinge bases, two clutches for wings; estimated pivot offsets.
- Page8: Four lime4x8 plates, two perwing overlapped4studs at24LDU height difference;20degree tilt provisional.
- Page9: One ordinary2x4+2x2 and three yellow curved2x3 forehead bricks.
- Page10: Two yellow Toolo2x4 rear bricks and two lower curvedcaps.
- Page11: Five upper yellow curvedcaps.
- Page12: Final opposite view only.

Source turntable swivel and wing-hinge rotation are inferred20degrees. The partial horn is not a finished claw assembly. Approved dev arm geometry is approximate; source-specific support/fit not certified. The source uses more short arms/hinges than45002 stock; exact extra quantities inBOM.

Unknowns: [{"id":"unknown","count":2,"page":5,"role":"blue opposed claws on horn end; specific identity and geometry missing"}]

Checker: PASS50.
Exact-color inventory rows and deficits inbom-inventory.json; absent9090rows areunknown, notzero. No Studio or physical verification, no acceptance, commit, publication, review flags or sharedDAT/metadata edits. Cumulative/final pixels await parent renderer.

## Current final3 pixel review

Actual current D final3 sheet plus original iso and iso-rear PNGs inspected against source p12 and wing detail p8. SHAb7068e09 matches current LDR. All views complete, no blank render. Two blue opposed horn-end claws remain missing; bare clutch is not a finished horn. Wing arrangement needs further source-pose refinement: source p8 visibly separates the two lime wing panels, whereas current render reads as one closely joined broad canopy; turntable swivel and hinge angles were provisional. Approximate long/short-arm geometry visibly differs from molded source shapes, and leg rake/hidden pin fit remain unverified. Checker PASS50 does not certify manual Toolo support or overlap. Final3 only, cumulative11 stages not reviewed; accepted false. See current-pixel-review.json for exact image hashes and pack revision. No model change in this review.

## Wing separation revision from source pages 7–8

Source evidence actually viewed: source/page-07.png shows two separate turntables, each with one hinge and one clutch; source/page-08.png shows two separated lime wing panels, each made from two overlapping 4x8 plates. Final source/page-12.png preserves the separate wings.

Earliest diagnosed placement error is page8: former plate centres Z=-80/+80 with half-width80 met exactly atZ=0. Keep page7 turntables at(80,-284,+/-80), hinge origins(80,-332,+/-80), and hinge pivots(32,-397,+/-80). Clutch localY60 reaches these pivots under existing20degree tilt. No unsupported change to turntable swivel is introduced.

Each plate pair is now shifted one40LDU stud outward and two40LDU studs rearward along the existing tilted wing plane. Page8 local plate offsets changed from(0,-24,0),(-160,-48,0) to(-80,-24,+/-40),(-240,-48,+/-40). World panel centres Z=+/-120 give an80LDU inner gap. Lower plate extent relative clutch is localX[-240,80], localZ[-40,120] or[-120,40], retaining the full clutch2x2 stud area inside the lower plate footprint. Upper/lower plate overlap remains160LDU and vertical difference24LDU. No stretch, reflection, new part or BOM quantity change.

The grid offset is a source-informed candidate, not an exact measured CAD reconstruction: source gives no calibrated turntable yaw or hinge angle. Parallel hinges and provisional20degree tilt are retained; alternatives such as different discrete stud offsets or turntable yaw require further pixel evidence, not arbitrary new parts. Two blue horn-end claws still omitted pending identity/geometry.

Checker PASS50 uses existing manual-part policy, not physical fitting certification. Prior current-pixel-review.json records the earlier source hash only. New final/cumulative renders pending; accepted=false.

Current model SHA256: 315062621f6838fd246d5fce94debb509319f0cefa1e1debb4ebe1a983b12a2f

## Revised wing final3 pixel review

Actual current final3 contact sheet and original iso-rear pixels inspected against previously actually viewed source p7/p8/p12. Source31506262 matches local LDR, pack3c96d98f. Two lime wings now visibly separate; iso and top show the intended central gap instead of a joined canopy. Rear view shows each plate group seated above its own clutch/hinge and turntable; no obvious floating wing or new plate intersection at this resolution. This supports visible pose only: exact pin engagement, turntable yaw and provisional20degree hinge angle lack calibrated source evidence. Lower plate footprint and stud-grid offsets preserve support as documented in REVIEW. Two blue horn-end claws remain missing; arm geometry approximate. Complete frame/no blank views. Final3 only, cumulative11 steps not reviewed; accepted false, no physical validation.


## Current cumulative pixel review

Current31506262 all11 cumulative frames actually inspected, originalstep7/8 and source7/8 reopened. Separate turntables/hinges/clutches visible before separated lime panels are added; panel mounts and central gap visible, no new unequivocal floating panel. Missing two blue horn claws persist from horn stage5 onward. Approximate limbs,20degree tilt/turntable yaw and source-informed offsets not calibrated; hidden engagement and six-leg stability unverified. Standard --steps record written, accepted=false; no physical validation.
