---
name: image-to-ldraw
description: Convert reviewed Duplo/large-brick build instruction images or PDFs into LDraw data. Use when Codex needs to analyze step images, identify supported Duplo parts, create a human-reviewable assembly JSON, generate .ldr/.mpd models, or validate brick placement for overlap, unsupported parts, incorrect dimensions, or floating assemblies.
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
- If a visual model is unsure, set lower `confidence`, add `assumptions`, and leave `needsReview: true`.
- Do not use raw web search for part facts. Use existing project MPDs/custom parts first; `resolve-parts.mjs` falls back only to the fixed LDraw mirror and writes a local cache.
- `validate-assembly.mjs` always checks straight-tube (`31452.dat`) alignment through arch openings and rejects elbows that re-enter a straight run interior. Exact `ldrawLine` pairs skip coarse brick-brick boxes and arch-frame boxes, but **wrong elbow direction can still pass** if it does not hit those checks—review 31195 chains against the step image.

## References

- Read `references/assembly-json.md` when drafting or reviewing `assembly.json`.
- Read `references/duplo-ldraw-conventions.md` when changing coordinate, orientation, or support behavior.
- Edit `references/part-metadata.json` before using a new part. The scripts intentionally fail on unknown or metadata-less parts.

## Scripts

- `scripts/resolve-parts.mjs`: verify/cache LDraw `.dat` sources for all parts in an assembly.
- `scripts/validate-assembly.mjs`: validate schema, part metadata, support, collision, and generated LDraw transforms.
- `scripts/assembly-to-ldraw.mjs`: emit `.ldr`, `.bom.json`, and `.report.json` from a reviewed assembly.
- `scripts/ldraw-common.mjs`: shared geometry and validation module used by the command scripts.
