# Assembly JSON Contract

`assembly.json` is an optional, human-readable representation for complex or uncertain builds. It is useful for support graphs, assumptions, tubes, accepted overlaps, and machine validation; it is not a mandatory pre-generation review gate. Small direct repairs may use a source-evidence table and a directly edited LDR. Draft JSON can contain unresolved entries, but unresolved or partial data is never publishable.

## Shape

```json
{
  "model": "example-model",
  "title": "Example Model",
  "sourceImages": ["slide-01.png"],
  "coordinateSystem": "LDraw Duplo grid; +Y down; one Duplo stud = 40 LDU.",
  "steps": [{
    "step": 1,
    "source": "slide-01.png",
    "placements": [{
      "id": "p001", "partId": "3011.dat", "colorCode": 1,
      "anchor": {"type": "centerStud", "x": 0, "z": 0},
      "orientation": "north", "support": {"type": "ground"},
      "confidence": 0.95, "sourceStep": 1, "assumptions": []
    }]
  }]
}
```

## Placement fields

`id` is stable and unique for support links, overlap exemptions, and reports. `partId` must be a known metadata ID for a resolved placement. Keep unresolved descriptions in review notes; do not pass invented IDs or placeholder placements to the converter. `orientation` is `north`, `east`, `south`, or `west`; a custom rotation uses the separate 9-number `transform` field. An exact `ldrawLine` still requires `support`.

Anchors are `{ "type": "centerStud", "x": 0, "z": 0 }` for integer grid placement or `{ "type": "originLdu", "x": 0, "y": -48, "z": 0 }` for exact LDraw-space placement. `centerStud` supplies X/Z while support determines Y; `originLdu` is for unusual parts.

`support` is an object: `{"type":"ground"}`, `{"type":"placements","ids":["p001","p002"]}`, or `{"type":"manual","reason":"specific source-backed connection"}`. `acceptedOverlaps` names only source-confirmed prior placements and gives a non-empty reason. `decorative: true` skips support/collision checks only for genuinely cosmetic parts. Record `confidence`, `sourceStep`, `assumptions`, `needsReview`, and tube-specific `tubeChecks` when applicable.

Examples of the non-grid fields:

```json
"support": {"type": "manual", "reason": "Side-built placement verified against source page 5."},
"acceptedOverlaps": [{"id": "p001", "reason": "Source page 10 confirms the intended stud interlock."}],
"tubeChecks": [{"type": "portConnection", "portId": "inlet",
  "targetPlacementId": "p024", "targetPortId": "start",
  "label": "elbow connects to straight tube"}]
```

`portConnection` may include `toleranceLdu` and `alignmentDotMax`; `portDelta` requires `fromPortId` and `toPortId`, with `min` and/or `max` axis objects for the intended direction bounds. Exact-transform (`ldrawLine`) placements still need support, and side-built manual support reasons are normally appropriate. Use placement-level overlap exemptions for one confirmed junction; do not silence a whole part with a global manual collision policy.

`portConnection` checks port-center proximity and opposing outward directions. `portDelta` checks a world-space delta; because LDraw +Y points downward, a downward bend has positive `y`.

For example, `{"type":"portDelta","fromPortId":"inlet","toPortId":"outlet","min":{"y":20},"max":{"z":-40}}` uses axis-keyed bounds, not scalar min/max values.

## Validation and use

When JSON is used, resolve parts and validate it before relying on the generated draft:

```bash
node .agents/skills/image-to-ldraw/scripts/resolve-parts.mjs path/to/assembly.json
node .agents/skills/image-to-ldraw/scripts/validate-assembly.mjs path/to/assembly.json
```

Fix unexplained errors. Validation does not establish visual truth, source fidelity, or acceptance; use the evidence/render workflow in `reconstruction-review.md`. Pack only the accepted specific model version after explicit publish authorization.

Tube checks, exact-transform side-built placements, accepted-overlap examples, and support semantics remain as implemented by `validate-assembly.mjs`; see `duplo-ldraw-conventions.md` for their geometry rules.
