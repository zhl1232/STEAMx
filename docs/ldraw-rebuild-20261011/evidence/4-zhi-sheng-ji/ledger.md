# 4+直升机 — source reconstruction draft

All 16 original PDF pages were actually viewed. Source SHA256: 4f366150ee004ae5922ab18ba5f80d765890adc7d31acaac67f2fe4052cf56c5. Model SHA256: da1b193b6033f66330e19acad3421aac8028c266b51562b0cf70e3b22b866d68. 89 placements, 15 additive steps; p16 final view adds none. Four window inserts are separate physical placements; two missing tail propellers are not counted as model placements.

|Source page|Implementation / support|
|---|---|
|1|24x24 green 4268 baseplate; 26 yellow 3437 border; seven 40666 plates form H. Border arrangement follows visible stair corners and has 26 blocks; exact grid awaiting render comparison.|
|2|Three black 4x6 lower body blocks, two upper body blocks; bridging supports on lower layer.|
|3|Two 74957 clutch blocks plus two dev-129 long arms as skids. Skids rest on H at Y=-24; clutch joints manual.|
|4|Two 28336 tail bases, orange 31196c01 cockpit, 6345 cream canopy. Uses recorded approved cockpit-canopy relative pose. Geometry approximate, raw conservative proxy overlaps.|
|5|Three yellow 3011 stacked front pillar and four 61649 red windows + four 90265 white panes. Window bottoms meet upper body; inserts use official hinge-relative offset.|
|6|Two long arm tail booms. Open fork at 28336 pivot (X248,Y-265,Z±80), closed end X648; same corrected 440 LDU geometry.|
|7|Two 74957 tail-end connectors. Two 86601 three-blade props deliberately omitted: known identity, geometry missing.|
|8|Three black roof blocks bridge window walls and front pillar.|
|9|60535 turntable base rests on roof; previously approved approximate geometry.|
|10|Four blue 40666 radial plates, center 2x2 opening; inner ends rest partly on turntable.|
|11|Two yellow 40666 form 4x4 hub cap, bridging four inner blue ends.|
|12|Four blue upper staggered plates bridge first-layer rotor arms.|
|13|Four blue lower outer plates extend arms; supported by overlap with previous upper layer.|
|14|Four blue upper outer plates bridge lower outer layer.|
|15|One yellow 3437 central brick + four yellow 40666 radial cap plates. Center is 24 LDU above cap plates as source appears; requires rendered confirmation.|
|16|Final presentation only.|

Raw checker: one error, cockpit/canopy conservative collision. Relative canopy R=[-1,0,0;0,0,1;0,1,0],t=(0,-34,-148) is copied from the approved metadata relation; metadata reports earlier exact face clipping without intersections, but that check has not been rerun here. No automatic collision exception or shared geometry changes. Source-specific hidden Toolo screw fit and skid/tail joints require manual review; no Studio or physical check asserted.

Inventory: black 86599 needs8 vs45002 quantity7 (extra1);74844 long arms need4 vs2 (extra2);74957 needs4 vs2 (extra2);86601 props need2 vs1(extra1). See bom-inventory.json for matched catalog rows/colors. Missing 9090 rows remain unknown, not zero.

Render and dependency closure: awaiting parent serial renderer, no additional Chrome started. This is incomplete and not approved for publication.

Correction: missing_parts is checking source tail propellers against86601 vs6669c01. Earlier86601 identity and45002 deficit assertions are provisional; do not treat them as confirmed until catalogue photo comparison completes.

Parent discovered scratch packer Windows path-boundary issue: dev-part basename could fall back to old embedded MPD. All prior dev-129 arm pixel/length acceptance is WITHDRAWN pending regenerated MPD with sourceSha evidence. Do not change LDR dimensions based on old rendered ratios. Source page reads, explicit axle-coordinate calculations and raw checker results remain recorded; they are not render certification.

Actual final3view pixels checked after packer repair: canopy sits on shell, windows/fuselage/skids/rotor/border load. Tail was visibly too low relative to sourcep6–16; corrected to20degree upward sweep, closed end(623.877048,-401.808057), with open fork unchanged at(248,-265). Both terminal clutches followed. New tail version requires re-render. Known shape simplifications remain.

missing_parts catalogue photo comparison confirms long narrow3blade6670c01, parentRebrickable evidence86601 alias. No available DAT found.45002containsone; helicopter requires2(extra1), drone4(extra3).

Latest actual pixels: iso and iso-rear source475f81ed, pack570807af were viewed after tail20degree upward correction. Long arms clear the rear deck in these views, no obvious tail/body collision. Two missing6670c01 props still make tail incomplete; no cumulative-step acceptance asserted.
