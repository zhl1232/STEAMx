# Thickness Review: Brick vs. Plate

A brick (`heightLdu: 48`, e.g. `3011.dat`, `3437.dat`) and a plate (`heightLdu: 24`, e.g.
`40666.dat`) look similar in a small instruction-icon and are easy to confuse — especially once a
generator script picks one `partId` as the default for a whole component. Confusing them is
exactly what made an earlier sword model's blade/guard/handle render as thick-brick sandwiches
when the PDF drew them as thin plates. Run this review whenever a step introduces a part you have
not already measured for that specific color+step, and again as a final pass before shipping.

## Do not assume — measure

Do not infer thickness from:

- a neighboring step that "looks the same" (the same color can appear as both a structural part
  and a cosmetic/thin part in the same model — in 宝剑's display stand, yellow is a thick brick in
  the support columns but sandwiched red *plates* carry the reinforcement elsewhere),
- whatever part the previous draft of the generator script happened to place,
- the generator's current default `partId`.

Measure the actual instruction-image icon for that exact step and color instead.

## Pixel measurement method

1. Render the source PDF page for the step to a PNG. Prefer `pdftoppm -png -r <dpi> instructions.pdf
   page` if `poppler-utils` is available; otherwise use a throwaway virtualenv (`python3 -m venv
   .tmp/pdfenv && .tmp/pdfenv/bin/pip install pymupdf`) with a few lines of `fitz` to call
   `doc.load_page(i).get_pixmap(dpi=...)`. Keep rendered pages in a scratch directory (e.g.
   `.tmp/<model>-check/pdf-pages/`), not in the repo.
2. Crop tightly to a single brick/plate icon's **front face** — the flat quadrilateral facing the
   viewer, not the top (stud) face or an angled side face. Iterate the crop rectangle with `sharp`
   (`.extract({ left, top, width, height })`) until the crop contains only that one face.
3. Measure the front face's pixel height and width, either by eye from the cropped image or by
   isolating the face's fill color and finding its bounding box.
4. Feed the two measurements to the classifier:

   ```bash
   node .agents/skills/image-to-ldraw/scripts/measure-thickness.mjs --height=88 --width=120
   ```

5. Calibrate `--thick-ratio`/`--thin-ratio` against an unambiguous brick icon and plate icon from
   the **same document** whenever you can find one. The script's defaults (0.73 / 0.62) were
   measured from the 宝剑 instructions.pdf legend and are a starting point, not a universal
   constant — icon proportions vary between PDF authors/renderers.
6. If the script reports `AMBIGUOUS`, or there is no calibration icon available at all, do not
   guess: lower `confidence`, add an `assumptions` entry describing what was measured, and set
   `needsReview: true` instead of silently picking a `partId`.

## Thickness checklist

Work through this before finalizing `partId` choices for a component, and again before packing
the final `.mpd`:

- [ ] Checked the legend/parts-used icon **for this exact step**, not a neighboring one.
- [ ] Measured (or explicitly calibrated-by-eye against a same-document reference) the front-face
      height/width ratio instead of assuming.
- [ ] Checked **every** occurrence of a repeated color separately — the same color can be a thick
      structural part in one component and a thin plate in another within the same model.
- [ ] The generator script's default `partId` matches the majority case for that section, with
      explicit, commented `partId` overrides for exceptions (not a silently-wrong copy-pasted
      placement call).
- [ ] Any front/center/back sandwich's `depth` spacing is derived from the actually-placed part's
      `heightLdu` (see
      `references/duplo-ldraw-conventions.md`, "Auto-deriving sandwich/depth spacing from part
      height"), not a literal left over from a previous draft.
- [ ] `validate-assembly.mjs` passes with no new/unexplained collision or support errors after any
      `partId` change (a thickness change shifts every downstream depth in that sandwich).

## Visual review: render vs. source screenshots

The validator only checks internal geometric consistency — it cannot tell you that a
self-consistent model still used the wrong-thickness part. Close that gap with a direct visual
comparison before calling a model done:

1. Pack the updated `.ldr` into the `public/courses/ldraw/*.mpd` that the lesson actually loads
   (`node scripts/pack-ldraw-model.mjs ...`). A stale `.mpd` keeps showing old geometry no matter
   how correct the regenerated `assembly.json`/`.ldr` are.
2. Open the lesson in the running app (`/courses/<id>/lessons/<n>`), switch to the **3D 搭建** tab
   (not **课件**, which just shows the original PDF page image, not the live model), and step to
   the step or final state under review.
3. Take a screenshot, then crop/zoom into the specific component under review — a full-canvas
   screenshot is usually too small to see a brick/plate distinction; a tight crop (e.g. with
   `sharp`) makes it obvious.
4. Render the corresponding source PDF page to a PNG (same method as the pixel-measurement step)
   and view it side by side with the cropped 3D screenshot.
5. Compare: relative thickness between different components/colors, overall silhouette and
   angles, and part counts. A component that looks visibly "chunkier" or "flatter" than its PDF
   counterpart means a `partId` mistake even if validation passed.
6. If the app was already open on this lesson before repacking, hard-reload or re-navigate — the
   dev server/browser can serve a cached `.mpd` and make a real fix look like it did nothing.
7. Repeat for at least the final step; spot-check 1-2 intermediate steps for multi-step
   components (a mistake introduced early can be masked once later steps add more geometry around
   it).
8. If the lesson's sidebar/parts-list copy (`content.building3d.parts`/`steps3d` or
   `content.steps` in `course_lessons`) names parts as "薄板"/"高砖", double-check the copy still
   matches the corrected model — a copy fix belongs in a *new* migration if the original one has
   already been applied (check `pnpm db:status`); do not edit an already-applied migration file.
