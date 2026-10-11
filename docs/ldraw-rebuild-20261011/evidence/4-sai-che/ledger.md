# 4-sai-che

{
  "slug": "4-sai-che",
  "status": "incomplete-pending-render-and-source-joints",
  "sourceSha256": "72064f97c043dbc88a88921b96c874fc12f127892a6c2a2221eac7e39d65f124",
  "sourcePages": 13,
  "allSourcePixelsViewed": true,
  "modelSha256": "36048b3b2e1724439581595e9113d437b57d625e43528045e5e0492884fe7d94",
  "placements": 40,
  "sourceStages": 12,
  "missing": [
    {
      "id": "4433c01",
      "count": 2,
      "page": 3,
      "role": "rear exhaust pipes"
    },
    {
      "id": "45117c01",
      "count": 1,
      "page": 6,
      "role": "blue Toolo spoiler"
    }
  ],
  "checker": "PASS raw LDR; manual support/collision parts excluded by existing catalog policy, no added exemptions",
  "metadataUsedHash": "35281b23d98e545b64fbfb0c733b44d0e1ab3336fe458ea992a0d64cb17c24ce",
  "render": "awaiting parent serial renderer",
  "accepted": false
}

## Source step correspondence

- Page1: 7 black Toolo bricks:3 lower,4 staggered upper
- Page2: 2 yellow Toolo 2x4 nose supports+2blue curved bricks
- Page3: 2 exhausts omitted (known identity, geometry unavailable)
- Page4: 4rims+4tires on lower-body side bores
- Page5: 2 black stepped rear tower bricks
- Page6: 1black vertical rear plate+2yellow side-built bricks; bluewing omitted
- Page7: 2red side supports
- Page8: 3 hinge bases, sideways pivot axes
- Page9: 3short arms forward bank
- Page10: 3short arms rear bank; each 200LDU axle span, matched adjacent endpoints
- Page11: 3sideways clutch blocks join rear short arms to wall; inner tongue fit inferred
- Page12: 2black side-built body panels
- Page13: Final view only

## Limitations

- Side-built rear wall/spoiler supports and clutch interfaces manual; blue spoiler omitted prevents source-complete silhouette.
- All Toolo parts use previously approved simplified geometry. Axle positions/threads are not physical certification.
- Inventory rows in bom-inventory.json require per-colour comparison; missing9090rows remainunknown, not zero.
- No screenshot claimed yet; parent render queue pending. No Studio or physical verification.

Parent discovered scratch packer Windows path-boundary issue: dev-part basename could fall back to old embedded MPD. All prior dev-129 arm pixel/length acceptance is WITHDRAWN pending regenerated MPD with sourceSha evidence. Do not change LDR dimensions based on old rendered ratios. Source page reads, explicit axle-coordinate calculations and raw checker results remain recorded; they are not render certification.

Actually viewed repaired-packer iso/iso-rear sourceSha36048b3b2e1724439581595e9113d437b57d625e43528045e5e0492884fe7d94. Wheels/body/caps/three arm chains load; known missing exhaust/wing leave rear silhouette incomplete. Yellowrear connectors orientation remains provisional awaiting missing wing evidence. No new obvious penetration observed; hidden joints not certified.
