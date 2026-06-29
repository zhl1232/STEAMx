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

Use exact `transform` or `ldrawLine` only for special decorative or non-grid elements.

### 45° ball tubes (`31195.dat`)

- Read `tubeJoint.chainLocal` in `part-metadata.json` when chaining elbows; do not guess stud-grid orientations.
- Straight `31452.dat` runs along local +Z. At the `-Z` end of a horizontal run, the first elbow usually starts with `rotZ(-90deg) * rotY(180deg)` (mirror of the `+Z`-end `rotZ(+90deg)`) so the first bend goes downward; for a 4-piece downward tail, chain std `chainLocal` for elbows 1–2 then mirrored `chainLocal` for elbows 3–4.
- Elbow chains still require human review against the instruction image. The validator checks straight-tube penetration and tube-vs-structure coarse overlap, but not elbow aim.

## Validation

Treat validation failures as modeling errors unless a part explicitly has `supportPolicy="manual"` or `decorative=true`.

- Structural parts must not collide with prior structural parts.
- A part supported by other placements must have its bottom connection plane aligned with the supporters' top plane.
- Support coverage defaults to 20% of the supported footprint unless the part metadata overrides it.
- Decorative parts are ignored for support and collision unless metadata says otherwise.
