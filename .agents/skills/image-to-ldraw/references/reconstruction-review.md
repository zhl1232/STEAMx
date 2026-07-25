# Source-First Reconstruction And Review

Use this checklist when rebuilding a course model from an instruction sequence or repairing an inaccurate LDR. It complements `assembly-json.md`, `duplo-ldraw-conventions.md`, and `thickness-review.md`; those project-specific metadata rules take precedence over generic assumptions about part height or origin.

## Evidence Order

1. Per-step instruction pages are ground truth for visible additions and step boundaries.
2. The finished-model image confirms the final silhouette and features hidden by later steps.
3. A reviewed physical kit, Studio file, or explicit user correction can resolve part IDs and hidden connections.
4. An existing LDR is only a hypothesis. Reuse a placement only after it agrees with stronger evidence.

Never force the printed count when doing so requires a collision or impossible placement. Record the discrepancy and prefer the geometry demonstrated by consecutive pages.

## Step Inventory

Before editing, compare each page with the previous page and record:

- source page and model step;
- added part ID or unresolved description;
- color and quantity;
- footprint, brick/plate thickness, and orientation;
- visible anchor/support and any hidden or inferred connection;
- confidence: visible, inferred from continuity, or unresolved.

For each step, keep two counts: additions on that page and cumulative placements through that page. A correct addition count can still hide a wrong earlier layer or a misplaced part.

## Occupancy And Landmark Ledger

Before placing coordinates, draw a stud-grid occupancy sketch for every changed step. For a normal upright model, use a top-view grid; for a side-built model, use its `u`/`v` source plane. Mark:

- occupied cells by part ID/color and orientation;
- intentional holes, cavities, and unsupported overhangs;
- the model's min/max extents on each axis;
- named visual landmarks visible in the source, such as wheel centers, basket corners, handle ends, window openings, roof tiers, and light bars.

Counts and collision checks do not prove this ledger. A model with the right parts can arrange them into the wrong object and still pass both. If the source perspective hides exact cells, mark the cells unresolved and use the next page, finished image, or a reviewed Studio export to resolve them before claiming visual verification.

Resolve the earliest divergent step first. Later geometry often hides an earlier wrong footprint, layer height, or rotation.

## Coordinate And Part Rules

- Use 40 LDU per Duplo stud and the axes declared in the model header. In normal upright models, +Y points downward and more-negative Y is higher.
- Ordinary full-height Duplo bricks are commonly 48 LDU, but always read `part-metadata.json`; plates, chassis, tubes, decorated parts, and custom geometry can differ.
- Keep one stable origin and facing throughout the model.
- Use exact orthonormal matrices for axis-aligned rotations. Document intentional angled transforms.
- Resolve exact official/local part geometry before substituting. Follow `missing-part-workflow.md` for unavailable parts and label every approved approximation.

## Incremental Reconstruction

1. Add a header naming the source, axes/grid convention, verification status, and all approximations.
2. Preserve the source sequence with `0 // STEP n - ...` and `0 STEP` boundaries.
3. Build bottom-up or along the instruction's actual assembly direction.
4. After each step, verify new parts are supported or intentionally bridged/angled and do not intersect earlier rigid parts.
5. For complex or uncertain builds, encode supports, confidence, assumptions, and accepted overlaps in `assembly.json` so `validate-assembly.mjs` can check them.

Do not leave a part floating unless the source shows a valid axle, tube, hinge, bridge, or documented hidden support. Do not use a generic brick to imitate an unavailable chassis, doorway, tube, wheel, frame, or decorated part without explicit approval and an approximation note.

## Validation Gates

These are separate gates; passing one does not imply the next.

### 1. Structural And Static Checks

For reviewed assembly JSON:

```bash
node .agents/skills/image-to-ldraw/scripts/resolve-parts.mjs path/to/assembly.json
node .agents/skills/image-to-ldraw/scripts/validate-assembly.mjs path/to/assembly.json
```

For a direct LDR repair:

```bash
node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs scripts/ldraw-models/model.ldr
node scripts/pack-ldraw-model.mjs scripts/ldraw-models/model.ldr model
```

The raw-LDR checker validates metadata, transforms, and collisions. Because raw type-1 lines do not contain a reviewed support graph, manually inspect every new step for contact/support or migrate the model to `assembly.json` before claiming structural support validation.

### 2. Renderer Review

Render every changed step and the final model. Use a source-matching isometric view plus fixed views where hidden geometry matters:

```bash
node .agents/skills/image-to-ldraw/scripts/preview-model.mjs public/courses/ldraw/model.mpd --step 4 --view iso --out .tmp/model-step-4.png
node .agents/skills/image-to-ldraw/scripts/preview-model.mjs public/courses/ldraw/model.mpd --view top --out .tmp/model-top.png
```

For each changed step, render from a view that matches the source page closely enough to compare the same visible faces. Fixed views are additional evidence, not a replacement for the source-matching view.

Use a written pass/fail checklist for each changed page:

- added BOM and cumulative BOM;
- stud-grid occupancy, openings, and overhangs;
- axis extents and total height;
- part orientation and stagger/interlock pattern;
- support/contact points;
- named silhouette landmarks and visible face order.

Correct the earliest failed item, repack, and repeat. Inspect at least `iso`, `front`, `rear`, `left`, `right`, and `top` for complex models. Do not label a model `renderer-verified only` from six-view renders or bounding-box similarity when the per-page checklist is missing.

When a user supplies a corrected Studio export, treat its transforms and step boundaries as higher-confidence evidence than an AI reconstruction. Diff placements by step, part/color, transform, occupancy, and extents; do not reduce the comparison to total counts.

### 3. Studio Review

When BrickLink Studio is available, open the delivered source and confirm it is nonblank, custom parts resolve, steps load, and orientation/framing are sensible. Static or renderer checks are not Studio verification.

## Delivery Wording

Report one of:

- `Studio-verified`: actually opened and inspected in BrickLink Studio.
- `renderer-verified only`: structural/static checks and source-comparison renders passed, but Studio was not used.
- `structurally checked only`: static checks passed, but visual rendering or Studio review was unavailable.

List unresolved warnings, unavailable parts, approved approximations, and hidden-connection assumptions explicitly.
