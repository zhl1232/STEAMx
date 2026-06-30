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

- `id`: unique stable ID, used by support links and reports.
- `partId`: LDraw part ID present in `part-metadata.json`.
- `colorCode`: numeric LDraw color code.
- `anchor`: use `centerStud` for grid placement or `originLdu` for exact LDraw-space placement.
- `orientation`: `north`, `east`, `south`, `west`, or a 9-number `transform`.
- `support`: `ground` or `placements`.
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
```

Do not encode layer numbers as final truth. If the image says "put this brick on p001", use support IDs and let metadata calculate Y from connection planes.

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
- Tube chains with exact `ldrawLine` transforms declare expected `tubeChecks` for adjacent port connections and direction-sensitive bends.
- Every non-ground part has support IDs unless it uses exact `originLdu` for a manual part.
- Every low-confidence or hidden placement has `assumptions` and `needsReview`.
- Step order matches the instruction images and final `.ldr` `0 STEP` order.
