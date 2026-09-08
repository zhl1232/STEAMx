# Thickness Review: Brick vs. Plate

Use this review only when a newly introduced or genuinely ambiguous part may be a brick versus a plate (or when an existing source-specific conclusion changes). Reuse a confirmed part ID and measurement from the same source/model across repeated colors and steps; do not repeat per-color/per-step measurement when the evidence is unchanged. Reopen the question when the source, component role, or evidence changes.

## Evidence

Measure the instruction icon for the ambiguous component, preferably against an unambiguous brick and plate icon in the same document. Crop the front face (not the top or angled side), measure pixel height and width, and use:

```bash
node .agents/skills/image-to-ldraw/scripts/measure-thickness.mjs --height=88 --width=120
```

Calibrate ratios against same-document references where possible. If calibration is unavailable or the result is `AMBIGUOUS`, preserve the uncertainty (`confidence` lower, an `assumptions` entry, and `needsReview: true`) rather than selecting a part silently. Read only the candidate part entries from `part-metadata.json`; ordinary bricks are often 48 LDU and plates 24 LDU, but metadata is authoritative. Derive side-built sandwich depth from the selected part's `heightLdu`, never a fixed 48/24 literal.

## Focused check

- Confirm the icon and role for the new/ambiguous component.
- Confirm the selected ID exists in metadata and matches the measured thickness.
- Recalculate dependent sandwich/depth placements after any ID change.
- Run the relevant structural/collision check and inspect the changed step and final state against the source.

Do not use a neighboring step, a generator default, or a repeated color as thickness evidence. A self-consistent validator result cannot prove the visual choice. Keep source screenshots and measurements in scratch space. If unresolved, leave the draft non-publishable and route it through the acceptance gate in `reconstruction-review.md`.
