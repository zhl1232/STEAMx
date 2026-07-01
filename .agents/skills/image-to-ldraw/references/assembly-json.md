# Assembly JSON Contract

Use this JSON as the human-review checkpoint between image analysis and LDraw generation.

## Shape

```json
{
  "model": "example-model",
  "title": "Example Model",
  "sourceImages": ["slide-01.png", "slide-02.png"],
  "coordinateSystem": "LDraw Duplo grid; +Y down; one Duplo stud = 40 LDU.",
  "steps": [
    {
      "step": 1,
      "source": "slide-01.png",
      "title": "Build the base",
      "placements": [
        {
          "id": "p001",
          "partId": "3011.dat",
          "colorCode": 1,
          "colorName": "Blue",
          "anchor": { "type": "centerStud", "x": 0, "z": 0 },
          "orientation": "north",
          "support": { "type": "ground" },
          "confidence": 0.95,
          "sourceStep": 1,
          "assumptions": []
        }
      ]
    }
  ]
}
```

## Placement Fields

- `id`: unique stable ID, used by support links, `acceptedOverlaps`, and reports.
- `partId`: LDraw part ID present in `part-metadata.json`.
- `colorCode`: numeric LDraw color code.
- `anchor`: use `centerStud` for grid placement or `originLdu` for exact LDraw-space placement. Omit when using `ldrawLine`.
- `orientation`: `north`, `east`, `south`, `west`, or a 9-number `transform`.
- `ldrawLine`: a full LDraw type-1 line (`1 <colour> x y z a b c d e f g h i <file>`) for exact-transform, non-grid placements — most commonly a side-built `u`/`v`/`depth` model (see `references/duplo-ldraw-conventions.md`). A placement with `ldrawLine` still needs `support`; it is not exempt from structural validation.
- `support`: `{type:"ground"}`, `{type:"placements", ids:[...]}`, or `{type:"manual", reason:"..."}`. `manual` requires a non-empty `reason` and is the normal choice for side-built grids that have no single top/bottom stacking plane to check automatically. Required on every `ldrawLine` placement.
- `acceptedOverlaps`: optional array of `{id, reason}` exempting a specific prior placement's collision from failing validation. Use for PDF-confirmed stud-level interlocking that the coarse axis-aligned collision box reports as a full overlap. `reason` must be non-empty and should reference the confirming instruction page. Prefer this over a part-level `collisionPolicy: "manual"`, which silences overlaps for that part everywhere instead of just the verified pair.
- `decorative`: set `true` to skip support and collision checks entirely for this placement (e.g. cosmetic add-ons with no structural role). Different from a manual support/overlap exemption, which still asserts the placement is intentional and reviewed.
- `confidence`: 0 to 1 score from visual analysis.
- `sourceStep`: original instruction step/page number.
- `assumptions`: text list for uncertain hidden structure, substitutes, or manual choices.
- `needsReview`: set true when confidence is low or hidden structure is inferred.
- `tubeChecks`: optional tube-specific validation checks for placements whose part metadata defines `tubePorts`.

## Supported Anchors

```json
{ "type": "centerStud", "x": 0, "z": 0 }
{ "type": "originLdu", "x": 0, "y": -48, "z": 0 }
```

`centerStud` controls X/Z only; Y comes from `support`. `originLdu` provides exact LDraw origin coordinates and is intended for unusual parts.

## Support

```json
{ "type": "ground" }
{ "type": "placements", "ids": ["p001", "p002"] }
{ "type": "manual", "reason": "Side-built exact-transform placement verified against instructions.pdf page 5, no single stacking plane to check automatically." }
```

Do not encode layer numbers as final truth. If the image says "put this brick on p001", use support IDs and let metadata calculate Y from connection planes. Use `manual` only when there truly is no meaningful ground/placements relationship to express — most commonly for side-built `ldrawLine` grids — and always give a specific `reason`, not a generic placeholder.

## Accepted Overlaps

```json
"acceptedOverlaps": [
  { "id": "p001", "reason": "Confirmed in instructions.pdf page 10: crossbar seats onto p001's top studs; coarse collision box reports the intended stud connection as a full overlap." }
]
```

Add this on either side of a known, PDF-confirmed overlap pair (only one side needs it; the validator checks both placements' lists). Each entry needs a real `id` of the overlapping placement and a non-empty `reason`. Do not add an entry for an overlap you have not actually confirmed against the source image — an unexplained collision error is telling you about a real modeling mistake far more often than a validator limitation.

## Tube Checks

Use `tubeChecks` for tube parts when the instruction image requires a specific connection or bend direction. The validator resolves ports from `part-metadata.json` in world coordinates; do not hard-code final coordinates in the check.

```json
{
  "type": "portConnection",
  "portId": "inlet",
  "targetPlacementId": "p024",
  "targetPortId": "start",
  "label": "tail elbow must connect to the straight tube -Z end"
}
```

`portConnection` checks that the named port center is close to a previously placed tube port and that the two outward directions face each other. Optional `toleranceLdu` and `alignmentDotMax` override the part metadata tolerances.

```json
{
  "type": "portDelta",
  "fromPortId": "inlet",
  "toPortId": "outlet",
  "label": "tail elbow must bend outward and downward",
  "min": { "y": 20 },
  "max": { "z": -40 }
}
```

`portDelta` checks the world-space delta from one port center to another. Remember LDraw +Y points downward, so a downward bend has a positive `y` delta.

## Review Checklist

- Every part exists in `part-metadata.json`.
- Every `ldrawLine` placement declares `support` (`ground`, `placements`, or `manual` with a specific reason) — it is validated exactly like grid placements, not skipped.
- Every `acceptedOverlaps` entry has a specific `reason` tracing back to the instruction image, not a generic placeholder.
- For side-built sandwiches (front/center/back layers at different `depth`), the `depth` spacing between adjacent layers matches the actual placed part's `heightLdu` from `part-metadata.json`, not a hard-coded number left over from a different part (see `references/duplo-ldraw-conventions.md#auto-deriving-sandwichdepth-spacing-from-part-height`).
- Tube chains with exact `ldrawLine` transforms declare expected `tubeChecks` for adjacent port connections and direction-sensitive bends.
- Every non-ground part has support IDs unless it uses exact `originLdu`/`ldrawLine` for a manual part.
- Every low-confidence or hidden placement has `assumptions` and `needsReview`.
- Step order matches the instruction images and final `.ldr` `0 STEP` order.
