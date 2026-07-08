# Missing LDraw Part Workflow

Use this workflow whenever a course model needs a part that is not already available in `part-metadata.json` and the local LDraw search path.

## Resolution Order

1. Confirm the exact part number from the course source, finished photo, physical kit, or user correction. Do not infer special Duplo/Toolo parts from shape alone. If the exact ID is unclear, ask the user before editing the `.ldr`.
2. Check existing local sources first:
   - `scripts/ldraw-models/parts/`
   - `scripts/ldraw-models/p/`
   - `scripts/ldraw-models/models/`
   - already-packed `public/courses/ldraw/*.mpd`
   - `.agents/skills/image-to-ldraw/references/part-metadata.json`
3. Run `resolve-parts.mjs` for the part ID. This checks local files, existing MPD blocks, and the fixed LDraw mirror used by the project.
4. If the fixed mirror does not have the part, search only reputable model sources that can be redistributed or committed under a clear license. Good candidates are the official LDraw library/tracker, Studio/BrickLink-exported LDraw-compatible custom parts with known provenance, or a maintained Duplo/Toolo parts pack with explicit redistribution terms.
5. If a real model is found and the license allows repository use, store the `.dat` and any required subparts locally under `scripts/ldraw-models/parts/` or `scripts/ldraw-models/p/`. Do not leave course builds dependent on a live web download.
6. Record the source in the part metadata notes: source URL or package name, retrieval date, original filename, license/provenance, and any local simplification or orientation adjustment.
7. Re-run `resolve-parts.mjs`, `validate-assembly.mjs` when assembly JSON exists, and the course-level collision/render checks before packing.

## When No Real Model Exists

Do not create a local simplified `.dat` automatically. Stop and ask the user, including the confirmed part ID, where you searched, and what tradeoff the placeholder would introduce.

Only after the user explicitly approves a simplified local model:

- Name it with the confirmed real part ID, not a made-up surrogate, so the lesson BOM stays reviewable.
- Mark `ldrawStatus` as `Local simplified part`.
- Set `supportPolicy` and/or `collisionPolicy` to `manual` when hinge pins, holes, tubes, or moving joints are not geometrically exact.
- Add notes explaining the user approval, what was checked, why no real source was used, and what geometry is simplified.
- Keep the placeholder visually close enough for step review, but do not claim it is an official or exact model.

For the current 4+孔雀 leg system, the user confirmed the IDs `45202.dat`, `74844.dat`, and `74847.dat`. The existing local files are temporary simplified geometry until a redistributable real Duplo/Toolo model is found; do not add more placeholders by analogy.
