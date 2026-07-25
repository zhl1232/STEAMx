---
name: image-to-ldraw
description: Reconstruct or repair Duplo/large-brick LDraw models from reviewed instruction images, PDFs, finished photos, or an inaccurate draft, or generate exploratory models from text descriptions. Use when Codex needs to inventory step additions, identify supported Duplo parts, create a human-reviewable assembly JSON, generate .ldr/.mpd models, validate brick placement for overlap, unsupported parts, incorrect dimensions, floating assemblies, or visual mismatch, or turn a natural-language building description into a valid Duplo LDraw assembly.
---

# Image To LDraw

## Overview

Use this skill to turn instruction evidence into reliable, reviewable LDraw source for the STEAM Explore large-brick course pipeline. The instruction sequence is ground truth; an existing LDR is only a hypothesis. Do not infer hidden structure, substitute look-alike parts, or add guessed parts from a single finished photo. If the part ID, geometry, orientation, or step placement is unclear, stop and ask the user.

## Workflow

1. Read `references/reconstruction-review.md`, then read the source images/PDF and identify the build steps. Prefer per-step instruction images over a single final photo. Inventory each step's additions before editing geometry.
2. Load `references/part-metadata.json` before selecting part IDs. Only use part IDs that are confirmed by the course source, a finished-photo/physical-kit review, or the user. If a part is missing from metadata, add metadata only after the exact part ID and geometry source are confirmed.
3. If the part metadata exists but the `.dat` model is missing, follow `references/missing-part-workflow.md`: resolve local/official sources first and commit redistributable real models locally. If no redistributable real model is found, ask the user before creating or using any simplified local geometry.
4. Draft an `assembly.json` using `references/assembly-json.md`. Record each placement with source step, confidence, assumptions, anchor, support relationship, and part ID.
5. Run `node .agents/skills/image-to-ldraw/scripts/resolve-parts.mjs <assembly.json>` to verify every part has a local or cached LDraw source.
6. Run `node .agents/skills/image-to-ldraw/scripts/validate-assembly.mjs <assembly.json>`. Fix all errors before generating LDraw.
7. After human review of the JSON, run `node .agents/skills/image-to-ldraw/scripts/assembly-to-ldraw.mjs <assembly.json> --out scripts/ldraw-models/<slug>.ldr`.
8. Use the project packer to produce an MPD: `node scripts/pack-ldraw-model.mjs scripts/ldraw-models/<slug>.ldr <slug>`.

## Repairing an Existing LDR

1. Treat the draft as a placement/part-ID hint, not as evidence. Compare consecutive source pages and find the earliest divergent step.
2. Record each step's added part, count, color, footprint, thickness, orientation, support, and confidence. Also record a stud-grid occupancy sketch for that step (top view for stacked models, source-plane view for side-built models), including deliberate holes and overhangs. A compact review table is sufficient for a small direct repair; use `assembly.json` when support or hidden geometry needs machine review.
3. Rebuild from the earliest wrong step forward. Do not translate or reshape the completed model until its final silhouette merely looks plausible.
4. Run the targeted raw-LDR check: `node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs scripts/ldraw-models/<slug>.ldr`. This validates parseable type-1 lines, known metadata, transforms, and collisions; it does not prove source fidelity or automatically prove support for a raw LDR.
5. Pack the current source, then render every changed step with `preview-model.mjs --step <n>`. Render the final state from `iso`, `front`, `rear`, `left`, `right`, and `top` views when shape or hidden connections are material.
6. Compare each render directly with its source page. For every changed step, check both the newly added BOM and cumulative BOM, the occupied stud cells, deliberate openings, outer extents, height, and named silhouette landmarks (for example handle end, wheel row, cabin opening, light bar). Record the result; "looks plausible" is not a pass. Correct the earliest remaining mismatch and repeat; a correct final silhouette does not excuse incorrect intermediate steps.
7. Open the result in BrickLink Studio when Studio is available. Report exactly one verification level: `Studio-verified`, `renderer-verified only`, or `structurally checked only`. Never imply Studio verification from parser or renderer output.

Do not report `renderer-verified only` unless every changed source page has a source-matching render and a written pass for inventory, occupancy/openings, extents/height, orientation, support, and silhouette landmarks. Fixed six-view renders alone are insufficient because a wrong layout can still have a plausible bounding box.

## Important Rules

- Treat `part-metadata.json` as the source of placement geometry. Do not hard-code brick height or assume every layer is 48 LDU.
- Reject unexplained floating parts and rigid-volume intersections. If the source requires a hidden support, bridge, axle, hinge, or coarse-validator overlap exception, document that exact connection; do not silently accept it.
- Use LDraw coordinates from `references/duplo-ldraw-conventions.md`: +Y points downward; stacking upward makes Y more negative.
- Express vertical placement through support relationships (`ground` or `placements`) wherever possible. The scripts compute Y by aligning the current part bottom connection plane to the supporter top connection plane.
- Use `originLdu` only for unusual parts that cannot be expressed by a regular stud-grid anchor.
- For a picture drawn from a single fixed side/isometric angle (not a ground-up stack — a sword, a silhouette), use the side-built `u`/`v`/`depth` `ldrawLine` pattern in `references/duplo-ldraw-conventions.md` ("Side-Built Models") instead of forcing it into `anchor`/`support`. Derive any front/center/back sandwich spacing from `heightLdu`, never a literal `±48`/`±24` — that exact mismatch previously made a sword model's blade render as thick bricks instead of thin plates.
- Every `ldrawLine` (exact-transform) placement must declare `support` explicitly, including `{type:"manual", reason:"..."}` for side-built grids with no single stacking plane. `validate-assembly.mjs` errors on a missing `support` and on any collision not covered by the placement's `acceptedOverlaps` or the part's `collisionPolicy` — exact transforms are validated, not skipped.
- Before trusting a color/step as "brick" vs "plate" (or any two similar-looking parts), measure it against the instruction image per `references/thickness-review.md` rather than assuming the previous step's part carries over.
- If a visual model is unsure, set lower `confidence`, add `assumptions`, leave `needsReview: true`, and ask before replacing uncertain parts or placements in a course `.ldr`.
- Do not use raw web search for part facts until local project sources and `resolve-parts.mjs` have failed. When a redistributable real model is found online, store it in the local LDraw search path and record source/license details in `part-metadata.json`; course builds should not depend on live web fetches.
- Do not create or use local simplified/custom `.dat` geometry unless the exact part number is confirmed and the user explicitly approves the approximation for that lesson. Mark the approximation in `ldrawStatus`, `supportPolicy`/`collisionPolicy`, and metadata notes.
- Do not create generator scripts that invent course models or substitute parts from descriptions. New course `.ldr` work should come from reviewed instruction images/PDF pages, Studio exports, or human-reviewed `assembly.json` data.
- `validate-assembly.mjs` checks straight-tube (`31452.dat`) alignment through arch openings, tube path interference, and tube port connections from `part-metadata.json`. For `31195.dat` elbow chains, add placement-level `tubeChecks` when the instruction step requires a specific bend direction or adjacent port connection.

## Text-to-Assembly Workflow

For exploratory generation from a natural-language description (not for repairing courseware against fixed instructions):

1. Read `references/text-to-assembly-guide.md` for the full workflow, coordinate rules, color codes, and few-shot examples.
2. Read `references/duplo-parts-cheatsheet.md` to select parts by category (brick, plate, slope, arch, etc.).
3. Plan the build bottom-to-top: ground layer first, then stacking layers.
4. Draft `assembly.json` following `references/assembly-json.md`. Use `centerStud` anchors with **integer** stud coordinates.
5. Run `validate-assembly.mjs` → fix errors → run `assembly-to-ldraw.mjs` → `pack-ldraw-model.mjs`.

Key differences from the image workflow:
- No source images or confidence scores needed — set `confidence: 1.0` and omit `sourceStep`.
- The AI must respect `part-metadata.json`: only use confirmed parts that exist in the catalog. For courseware repair, do not use this workflow as a substitute for PDF/step-image review.
- Stud grid alignment is enforced: non-integer centerStud coordinates produce warnings.

## References

- Read `references/assembly-json.md` when drafting or reviewing `assembly.json`.
- Read `references/reconstruction-review.md` before rebuilding or repairing an existing LDR from PDFs, page images, or finished-model evidence.
- Read `references/duplo-ldraw-conventions.md` when changing coordinate, orientation, or support behavior, and especially before building a side-built (non-ground-up) model.
- Read `references/thickness-review.md` before finalizing part choices and before final visual review — it covers measuring brick-vs-plate thickness from instruction images and the step-by-step-render comparison pass.
- Read `references/missing-part-workflow.md` before adding a new local/custom part or using a simplified placeholder.
- Read `references/text-to-assembly-guide.md` for the text-to-assembly workflow, coordinate rules, color codes, and few-shot examples.
- Read `references/duplo-parts-cheatsheet.md` for a categorized quick-reference of commonly used Duplo parts.
- Edit `references/part-metadata.json` before using a new part. The scripts intentionally fail on unknown or metadata-less parts.

## Scripts

- `scripts/resolve-parts.mjs`: verify/cache LDraw `.dat` sources for all parts in an assembly.
- `scripts/validate-assembly.mjs`: validate schema, part metadata, support, collision, and generated LDraw transforms.
- `scripts/assembly-to-ldraw.mjs`: emit `.ldr`, `.bom.json`, and `.report.json` from a reviewed assembly.
- `scripts/ldraw-common.mjs`: shared geometry and validation module (AABB + OBB collision, stud grid alignment) used by the command scripts.
- `scripts/measure-thickness.mjs`: classify a measured instruction-icon front face as brick-thick or plate-thin (see `references/thickness-review.md`).
- `scripts/check-ldr-collision.mjs`: run metadata/transform/collision checks across unpacked LDRs, or target one or more explicit `.ldr` paths even when a matching MPD already exists.
- `scripts/preview-model.mjs`: render a packed LDR/MPD by step and fixed view (`iso`, `iso-rear`, `front`, `rear`, `left`, `right`, `top`) for source comparison.
- `scripts/fetch-duplo-parts.mjs`: download official LDraw library and extract all Duplo parts into `references/duplo-parts-index.json`.
- `scripts/generate-metadata.mjs`: auto-generate `part-metadata.json` entries from the Duplo parts index.
