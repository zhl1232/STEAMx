---
name: image-to-ldraw
description: Generate or repair Duplo/large-brick LDraw drafts from instruction images, PDFs, photos, or exploratory text, validate geometry, and prepare local 3D previews for acceptance and authorized publication.
---

# Image To LDraw

## Default flow

Read evidence → build local draft → validate and preview → human acceptance → authorized publication. Draft generation does not require prior JSON review. Studio is optional for complex or disputed connections; the local `/ldraw-preview` page is the normal acceptance surface.

1. **Scope evidence.** For course reconstruction, source steps define additions and order; finished photos clarify the final shape. Existing LDRs are hypotheses unless already accepted against the same source. Read only the relevant source pages and metadata entries for parts used in this model; scripts load the complete catalog. Never paste the whole metadata catalog into context.
2. **Build a draft.** Direct LDR edits are appropriate for small repairs; use temporary `assembly.json` for complex support/transform work. Preserve source step boundaries. Unknown IDs or connections stay explicitly unresolved; do not invent parts or silently substitute similar geometry. An incomplete local preview may omit unresolved parts if clearly labeled; it is not publishable.
3. **Check once, then review visually.** With assembly JSON, resolve parts and validate before conversion; direct LDRs use the raw-LDR checker. Consolidate source matching, BOM, thickness, openings, orientation, and support into the single checklist in [reconstruction-review.md](references/reconstruction-review.md). Scripts checking collisions do not prove source fidelity or physical support.
4. **Present one acceptance package.** Provide the local preview link, changed steps, check summary, and unresolved items. Human acceptance covers the exact model/source/dependency version. Reuse unchanged evidence; revisions require review of affected steps and downstream dependencies. Studio is supplementary, never claim it was used when it was not.
5. **Publish only after acceptance and explicit publication authorization.** These may be given together. Match the accepted version and target course before writing public MPD assets, uploading, or updating lesson content. Then verify the published model, dependencies, step count, and lesson mapping. A draft request is complete with a checked preview and honest status; an authorized publish task continues through verification.

## Commands and artifact boundaries

- Assembly drafts: `resolve-parts.mjs <assembly.json>` → `validate-assembly.mjs <assembly.json>` → `assembly-to-ldraw.mjs <assembly.json> --out .tmp/<slug>/model.ldr`. These scripts live in this skill's `scripts/` directory. Conversion refuses validation errors and emits temporary BOM/report files.
- Direct drafts: `node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs <explicit-model.ldr>`. Inspect support separately because raw LDR has no support graph.
- Preview: use the local app's `/ldraw-preview?model=<filename.ldr>` for sources in `scripts/ldraw-models/`, or paste a scratch draft into its custom-source editor. Its local `POST /api/ldraw-preview` accepts `{ldrText, modelName}` and returns an in-memory MPD; this does not publish assets. Do not deploy the preview app as part of preparing a draft.
- Publication: `node scripts/pack-ldraw-model.mjs <accepted-source.ldr> <slug>` writes `public/courses/ldraw/<slug>.mpd`; it is not the draft-preview command. Upload/content updates remain limited to the authorized lesson and assets.
- Keep draft assembly/BOM/review records in scratch space, accessible until acceptance. Final model sources are `.ldr`; do not add per-model generators or generated-output tests.

## Non-negotiable geometry rules

- Use confirmed catalog parts and their actual dimensions/origins; never assume every brick is 48 LDU. Duplo stud pitch is 40 LDU, and normal upright LDraw +Y points down.
- Reject unexplained floating parts, rigid intersections, and invalid transforms. Document source-backed support and overlap exceptions; do not silence checks to make a draft pass.
- Exact-transform assembly placements must declare support. Side-built spacing derives from the placed parts' `heightLdu`, not hard-coded offsets.
- Missing geometry: search allowed local/official sources first. Simplified/custom geometry still requires a confirmed real part ID and explicit approval of that approximation; unresolved geometry does not become approved merely because a draft is requested.
- Text-only exploration may choose confirmed catalog parts creatively, but must not replace source-based reconstruction of a course model.

## Read only when needed

- [reconstruction-review.md](references/reconstruction-review.md): consolidated review, evidence reuse, acceptance, and publication.
- [assembly-json.md](references/assembly-json.md): when using assembly JSON, not required for direct repairs.
- [duplo-ldraw-conventions.md](references/duplo-ldraw-conventions.md): unfamiliar axes, origins, side-built transforms, or support.
- [thickness-review.md](references/thickness-review.md): new or ambiguous brick/plate identification; reuse confirmed same-source part evidence.
- [missing-part-workflow.md](references/missing-part-workflow.md): unavailable parts or proposed approximations.
- [text-to-assembly-guide.md](references/text-to-assembly-guide.md) and [duplo-parts-cheatsheet.md](references/duplo-parts-cheatsheet.md): text-only exploratory builds.

## Token budget discipline

Query only used IDs from `references/part-metadata.json`, for example:
`node -e 'const m=require("./.agents/skills/image-to-ldraw/references/part-metadata.json"); console.log(JSON.stringify({grid:m.grid,part:m.parts[process.argv[1]]}))' 3011.dat`.
Read orientation matrices only if needed. Preserve useful geometry fields in the selected records.

Keep one temporary review record tied to source images, model, used part geometry/metadata, and validator versions or hashes. Reuse only unchanged inputs; recheck changed steps and their downstream dependencies. New models need a complete step review. This is a work-record convention, not an implemented automatic cache.

Store full logs/screenshots locally; report summary counts, failures, ambiguities, and the preview link. Reuse the same visual pass for thickness and source matching. Add views only when they reveal relevant geometry; do not repeat full six-view/per-step reviews after unrelated edits.
