---
name: image-to-ldraw
description: Convert reviewed Duplo/large-brick build instruction images or PDFs into LDraw data, or generate LDraw models from text descriptions. Use when Codex needs to analyze step images, identify supported Duplo parts, create a human-reviewable assembly JSON, generate .ldr/.mpd models, validate brick placement for overlap, unsupported parts, incorrect dimensions, or floating assemblies, or turn a natural-language building description into a valid Duplo LDraw assembly.
---

# Image To LDraw

## Overview

Use this skill to turn instruction images into reliable, reviewable LDraw source for the STEAM Explore large-brick course pipeline. Do not try to infer hidden structure from a single finished photo without marking uncertainty and asking for review.

## Workflow

1. Read the source images/PDF and identify the build steps. Prefer per-step instruction images over a single final photo.
2. Load `references/part-metadata.json` before selecting part IDs. Only use parts present in this metadata. If a part is missing, add metadata first instead of guessing dimensions.
3. Draft an `assembly.json` using `references/assembly-json.md`. Record each placement with source step, confidence, assumptions, anchor, support relationship, and part ID.
4. Run `node .agents/skills/image-to-ldraw/scripts/resolve-parts.mjs <assembly.json>` to verify every part has a local or cached LDraw source.
5. Run `node .agents/skills/image-to-ldraw/scripts/validate-assembly.mjs <assembly.json>`. Fix all errors before generating LDraw.
6. After human review of the JSON, run `node .agents/skills/image-to-ldraw/scripts/assembly-to-ldraw.mjs <assembly.json> --out scripts/ldraw-models/<slug>.ldr`.
7. Use the project packer to produce an MPD: `node scripts/pack-ldraw-model.mjs scripts/ldraw-models/<slug>.ldr <slug>`.

## Important Rules

- Treat `part-metadata.json` as the source of placement geometry. Do not hard-code brick height or assume every layer is 48 LDU.
- Use LDraw coordinates from `references/duplo-ldraw-conventions.md`: +Y points downward; stacking upward makes Y more negative.
- Express vertical placement through support relationships (`ground` or `placements`) wherever possible. The scripts compute Y by aligning the current part bottom connection plane to the supporter top connection plane.
- Use `originLdu` only for unusual parts that cannot be expressed by a regular stud-grid anchor.
- For a picture drawn from a single fixed side/isometric angle (not a ground-up stack — a sword, a silhouette), use the side-built `u`/`v`/`depth` `ldrawLine` pattern in `references/duplo-ldraw-conventions.md` ("Side-Built Models") instead of forcing it into `anchor`/`support`. Derive any front/center/back sandwich spacing from `heightLdu`, never a literal `±48`/`±24` — that exact mismatch previously made a sword model's blade render as thick bricks instead of thin plates.
- Every `ldrawLine` (exact-transform) placement must declare `support` explicitly, including `{type:"manual", reason:"..."}` for side-built grids with no single stacking plane. `validate-assembly.mjs` errors on a missing `support` and on any collision not covered by the placement's `acceptedOverlaps` or the part's `collisionPolicy` — exact transforms are validated, not skipped.
- Before trusting a color/step as "brick" vs "plate" (or any two similar-looking parts), measure it against the instruction image per `references/thickness-review.md` rather than assuming the previous step's part carries over.
- If a visual model is unsure, set lower `confidence`, add `assumptions`, and leave `needsReview: true`.
- Do not use raw web search for part facts. Use existing project MPDs/custom parts first; `resolve-parts.mjs` falls back only to the fixed LDraw mirror and writes a local cache.
- `validate-assembly.mjs` checks straight-tube (`31452.dat`) alignment through arch openings, tube path interference, and tube port connections from `part-metadata.json`. For `31195.dat` elbow chains, add placement-level `tubeChecks` when the instruction step requires a specific bend direction or adjacent port connection.

## Text-to-Assembly Workflow

For generating a Duplo model from a natural-language description (no instruction images):

1. Read `references/text-to-assembly-guide.md` for the full workflow, coordinate rules, color codes, and few-shot examples.
2. Read `references/duplo-parts-cheatsheet.md` to select parts by category (brick, plate, slope, arch, etc.).
3. Plan the build bottom-to-top: ground layer first, then stacking layers.
4. Draft `assembly.json` following `references/assembly-json.md`. Use `centerStud` anchors with **integer** stud coordinates.
5. Run `validate-assembly.mjs` → fix errors → run `assembly-to-ldraw.mjs` → `pack-ldraw-model.mjs`.

Key differences from the image workflow:
- No source images or confidence scores needed — set `confidence: 1.0` and omit `sourceStep`.
- The AI must respect `part-metadata.json`: only use parts that exist in the catalog.
- Stud grid alignment is enforced: non-integer centerStud coordinates produce warnings.

## References

- Read `references/assembly-json.md` when drafting or reviewing `assembly.json`.
- Read `references/duplo-ldraw-conventions.md` when changing coordinate, orientation, or support behavior, and especially before building a side-built (non-ground-up) model.
- Read `references/thickness-review.md` before finalizing part choices and before final visual review — it covers measuring brick-vs-plate thickness from instruction images and the step-by-step-render comparison pass.
- Read `references/text-to-assembly-guide.md` for the text-to-assembly workflow, coordinate rules, color codes, and few-shot examples.
- Read `references/duplo-parts-cheatsheet.md` for a categorized quick-reference of commonly used Duplo parts.
- Edit `references/part-metadata.json` before using a new part. The scripts intentionally fail on unknown or metadata-less parts.

## Scripts

- `scripts/resolve-parts.mjs`: verify/cache LDraw `.dat` sources for all parts in an assembly.
- `scripts/validate-assembly.mjs`: validate schema, part metadata, support, collision, and generated LDraw transforms.
- `scripts/assembly-to-ldraw.mjs`: emit `.ldr`, `.bom.json`, and `.report.json` from a reviewed assembly.
- `scripts/ldraw-common.mjs`: shared geometry and validation module (AABB + OBB collision, stud grid alignment) used by the command scripts.
- `scripts/measure-thickness.mjs`: classify a measured instruction-icon front face as brick-thick or plate-thin (see `references/thickness-review.md`).
- `scripts/fetch-duplo-parts.mjs`: download official LDraw library and extract all Duplo parts into `references/duplo-parts-index.json`.
- `scripts/generate-metadata.mjs`: auto-generate `part-metadata.json` entries from the Duplo parts index.
