# Reconstruction, Evidence, Verification, And Acceptance

This is the authoritative review workflow for rebuilding a model from instruction pages, a finished photo, a Studio file, or an inaccurate LDR. It covers exploratory drafts and publishable assets separately. `assembly-json.md`, `duplo-ldraw-conventions.md`, and `thickness-review.md` provide field and geometry details.

## Evidence and unresolved items

Use evidence in this order:

1. Instruction pages establish visible additions and step boundaries.
2. The finished image confirms final silhouette and features hidden by later steps.
3. A reviewed physical kit, Studio file, or explicit user correction may resolve IDs and hidden connections.
4. An existing LDR is a hypothesis until it agrees with stronger evidence.

For each step record source page, additions and cumulative placements, ID (or unresolved description), color/count, footprint and thickness, orientation, support/hidden connection, and confidence (`visible`, `inferred`, or `unresolved`). Record unknown IDs and partial geometry explicitly. Never guess an ID, force a printed count through a collision, or invent a simplified/custom part. An unresolved or partial draft is not publishable; pause only the affected placement/model while continuing independent checks.

Maintain a compact occupancy and landmark ledger for changed steps: occupied stud cells, holes/cavities, intentional overhangs, axis extents, and landmarks such as wheel centers, openings, corners, handles, and roof tiers. Counts and collision checks do not prove visual correctness. Resolve the earliest divergent step first.

## Draft and local preview

Generate a local draft as soon as the evidence permits; do not require a fully accepted JSON document before exploring geometry. A small direct repair may use a reviewed table and edit an LDR directly. Use `assembly.json` when support graphs, hidden connections, tubes, complex placement, or machine validation materially help; it is an optional representation, not a mandatory gate.

Drafts may contain unresolved entries and assumptions, but must carry source/model identity and verification status and must remain outside public course assets. Preview them in the existing `/ldraw-preview` workspace. The preview API accepts an in-memory model with `GET /api/ldraw-preview?model=...` or a `POST` source payload; use it to inspect a draft without packing it into `public/`. Studio is optional and reserved for complex or unclear connections, custom parts, or a user-supplied Studio source.

Use stable axes and origin, 40 LDU per Duplo stud, exact orthonormal transforms for axis-aligned rotations, and metadata-derived part dimensions. Preserve instruction boundaries (`0 // STEP n - ...`, `0 STEP`) and build in the source's actual assembly direction. Every new part must be supported or intentionally bridged/angled; document manual supports and source-confirmed overlaps.

## Temporary instruction cache

For repeated work, a temporary review record may be reused only when it is bound to the same source identity, model/version, relevant metadata version, and validator/script versions. Reuse unchanged records; when a source, placement, part metadata, or validator changes, recheck that item and all dependent downstream steps. New models require a complete record. This is a documentation convention, not an instruction to invent caching automation. Scripts should load the full metadata needed for correctness while exposing or reporting only the selected records relevant to the current model.

## Verification and acceptance

Run checks appropriate to the representation:

```bash
node .agents/skills/image-to-ldraw/scripts/resolve-parts.mjs path/to/assembly.json
node .agents/skills/image-to-ldraw/scripts/validate-assembly.mjs path/to/assembly.json
node .agents/skills/image-to-ldraw/scripts/check-ldr-collision.mjs scripts/ldraw-models/model.ldr
```

Render every changed step and the final state from a source-matching view. Add top/front/rear/left/right views only when hidden geometry or an informative comparison requires them; six views are not a universal requirement. Compare additions, cumulative occupancy, extents, thickness, support/contact, orientation, landmarks, silhouette, and visible face order. Correct the earliest failed item and repeat. A Studio file, when used, must actually be opened and checked for nonblank content, resolved custom parts, step loading, and sensible framing; renderer output is not Studio verification.

Acceptance happens in `/ldraw-preview` after these checks. Record the accepted specific model version, source references, unresolved warnings, unavailable parts, approved approximations, and verification level. Publishing is a separate release gate: pack only that accepted version, and only after explicit publish authorization. Do not pack a draft or use a stale public MPD as evidence.

Report exactly one level: `Studio-verified`, `renderer-verified only`, or `structurally checked only`, with warnings and assumptions listed.
