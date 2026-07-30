# Duplo LDraw Conventions

Use these rules for STEAM Explore large-brick LDraw work.

## Coordinates

- LDraw units are LDU.
- Duplo stud pitch is 40 LDU.
- +Y points downward. Building upward makes world Y smaller.
- Most Duplo brick `.dat` files in this project use a top-centered origin: top connection plane at local `y=0`, bottom connection plane at local `y=height`.
- Never assume all parts are 48 LDU tall. Read `heightLdu`, `origin.originToTop`, `origin.originToBottom`, and `connectionSurfaces` from `part-metadata.json`.

## Placement

Prefer logical placements:

- `anchor.type="centerStud"` for ordinary stud-grid parts.
- `anchor.type="originLdu"` for exact LDraw-space placement.
- `support.type="ground"` for the first layer.
- `support.type="placements"` with one or more placement IDs for stacked parts.

The generator computes Y by aligning the current part's bottom connection plane to the supporter's top connection plane. It should not multiply a layer number by a constant.

## Orientation

Use named orientations for axis-aligned parts:

- `north`: local X stays world X, local Z stays world Z.
- `east`: local X turns to world Z.
- `south`: local X and Z are both flipped.
- `west`: local X turns to negative world Z.

Use exact `transform` or `ldrawLine` only for special decorative or non-grid elements, or for a side-built model (see below).

## Side-Built Models (exact-transform u/v/depth grids)

Some instruction sets are drawn from a single fixed side/isometric angle instead of a stack built up from the ground — a sword on a display stand, a dinosaur silhouette, anything where the picture reads left-to-right/top-to-bottom rather than layer-by-layer. Model these on a `u`/`v`/`depth` stud grid with exact `ldrawLine` transforms instead of `anchor` + `support`-computed Y. Published course models keep only the human-reviewed `.ldr`; do not add per-model generator scripts as reference implementations.

### Coordinate convention

- `u`: horizontal position, in studs, mapped to world X (`x = u * 40`).
- `v`: row position, in studs, mapped to world Y (`y = v * 40`).
- `depth`: front/center/back layer position, in LDU directly (not studs), mapped to world Z.

```js
function ldrawLine({ partId, color, u, v, depth = 0, orientation }) {
  return ['1', color.code, u * 40, v * 40, depth, ...MATRIX[orientation], partId].join(' ')
}
```

### Orientation matrices

Two orientations cover most side-built pieces. Verify what a matrix actually does with `transformPoint` from `ldraw-common.mjs` against the part's `bbox` before trusting it — do not assume a permutation-looking matrix behaves like a clean 90° rotation:

- `sideHorizontal: [1,0,0, 0,-1,0, 0,1,0]` — pieces whose stud-length axis runs along `u` (a blade segment, a horizontal beam). Local length maps straight to world X, so `u` spacing between adjacent placements must equal the part's stud length or they will gap/overlap. Local height (`heightLdu`) sweeps diagonally into **both** world Y and world Z between the part's top and bottom connection planes. Local width does not independently move the geometry: treat every placement as a flat depth-slice, and separate layers only through `depth`, never by relying on a part's own footprint.
- `sideVertical: [0,0,-1, -1,0,0, 0,1,0]` — pieces whose stud-length axis runs along `v` (a support column spanning several rows). Local length maps to world Y, local width maps to world X, and local height maps straight to world Z (the depth axis, no diagonal sweep this time).

### Auto-deriving sandwich/depth spacing from part height

`sideHorizontal`'s diagonal height sweep lands a part's bottom connection plane exactly `heightLdu` further into `depth` than its top. A front/center/back sandwich therefore stacks with zero gap and zero overlap only when the `depth` spacing between adjacent layers equals that part's real `heightLdu`. Hard-coding the spacing (always `±48`, say) silently breaks the moment a layer switches between a thick brick (`heightLdu: 48`) and a thin plate (`heightLdu: 24`) — this was the root cause of the 宝剑 blade/guard/handle rendering as thick-brick sandwiches when they were meant to be thin plates. Always derive spacing from metadata instead of a literal number:

```js
function partHeightLdu(partId) {
  const meta = PART_METADATA.parts?.[partId]
  if (!meta || typeof meta.heightLdu !== 'number') {
    throw new Error(`missing heightLdu metadata for ${partId}`)
  }
  return meta.heightLdu
}

const PLATE_H = partHeightLdu(PART.duplo24Plate) // 24, not a literal
const DEPTH = { front: -PLATE_H, center: 0, back: PLATE_H }
```

If the sandwich later swaps which `partId` it places, `DEPTH` recalculates automatically instead of silently drifting out of sync with the part actually being rendered. Whenever a step's picture shows a color that might be a plate or a brick, measure it (see the thickness checklist in `references/thickness-review.md`) before picking the default `partId` — do not assume every layer uses the same part.

### Support and collision documentation for side-built placements

Exact-transform placements have no automatic top/bottom stacking graph, but `validate-assembly.mjs` still requires every placement to declare `support` (see Validation below). Side-built models normally share one manual-support reason across every placement, applied inside the shared `place()` helper:

```js
const SIDE_BUILT_SUPPORT = {
  type: 'manual',
  reason: 'Side-built exact-transform placement on the shared u/v/depth stud grid, verified against instructions.pdf per-step images rather than a stacked top/bottom connection.',
}
```

The coarse axis-aligned collision box cannot represent stud-level interlocking (a crossbar seating onto a column's top studs, a plate spanning two columns). When the instruction image confirms a specific junction is intentional, exempt only that pair with a placement-level `acceptedOverlaps` entry and a concrete, page-referenced reason. Do not reach for a part-level `collisionPolicy: "manual"` for a one-off junction — that silences every overlap involving that part everywhere, not just the verified spot:

```js
function standJunctionOverlap(counterpartIds) {
  return (Array.isArray(counterpartIds) ? counterpartIds : [counterpartIds]).map((counterpartId) => ({
    id: counterpartId,
    reason: `Confirmed in instructions.pdf: interlocks with ${counterpartId} at a shared stud; coarse collision box reports the intended stud connection as a full overlap.`,
  }))
}
```

### 45° ball tubes (`31195.dat`)

- Read `tubeJoint.chainLocal` in `part-metadata.json` when chaining elbows; do not guess stud-grid orientations.
- Straight `31452.dat` runs along local +Z. In the long-neck dinosaur tail, the `-Z` end of the horizontal run uses `rotZ(+90deg) * rotY(180deg)` so local +Z connects to the straight tube `start` port and the first 45-degree elbow bends downward (+Y) and outward (-Z).
- Elbow chains still require review against the instruction image. Add `tubeChecks` to exact-transform placements so the validator can enforce adjacent port connections and direction-sensitive bends from `tubePorts`.

## Validation

Treat validation failures as modeling errors unless a part explicitly has `supportPolicy="manual"`/`collisionPolicy="manual"`, a placement has `decorative: true`, or the specific case is covered by a placement-level `support.type="manual"` or `acceptedOverlaps` entry below.

- Structural parts must not collide with prior structural parts. A placement can overlap at most the priors it explicitly lists in `acceptedOverlaps`; any other overlap is an error, and all overlaps for a placement are reported together instead of stopping at the first one.
- A part supported by other placements must have its bottom connection plane aligned with the supporters' top plane.
- Every exact-transform (`ldrawLine`) placement must declare `support` explicitly: `{type:"ground"}`, `{type:"placements", ids:[...]}`, or `{type:"manual", reason:"..."}` for side-built grids with no single meaningful stacking plane (see Side-Built Models above). A missing `support` on an exact-transform placement is a validation error, not a silent skip — this used to be skipped by accident for every `ldrawLine` placement, which is why older side-built models need the retrofit described above.
- `support.type="manual"` and `acceptedOverlaps` entries both require a non-empty `reason`; the validator throws if the reason is missing or blank.
- Support coverage defaults to 20% of the supported footprint unless the part metadata overrides it.
- Decorative parts (`placement.decorative: true` or `part.supportPolicy === "decorative"`) are ignored for support and collision.
- A detected collision is downgraded from error to warning when either placement's `acceptedOverlaps` names the other (with a reason), or when either part has `collisionPolicy: "manual"`. Prefer placement-level `acceptedOverlaps` for one-off, PDF-confirmed junctions; reserve part-level `collisionPolicy: "manual"` for parts that are structurally exempt everywhere they appear (e.g. interlocking tube ports).
- Tube parts with `tubePath`/`tubePorts` are checked for path interference, aligned port connections, and any placement-level `tubeChecks`.
