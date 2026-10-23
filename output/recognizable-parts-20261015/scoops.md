# Toolo scoop / exhaust shape review (2026-10-15)

This scratch review covers the delegated files `dev-toolo/6294.dat`,
`dev-toolo/6310.dat`, and `dev-129/4433c01.dat`. No source geometry was
changed in this pass: the two scoop candidates are already local, clearly
identified approximations, and the exhaust candidate already contains the
photo-supported perforated body and end connectors.

## Photo evidence

- 6294: [BrickLink catalog](https://www.bricklink.com/v2/catalog/catalogitem.page?P=6294&idColor=22),
  [seller photo](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Scoop-6-x-4-x-3-Green-6294-a1.jpg).
  The viewed photo shows a broad open bowl, curved side cheeks, a rolled/curved
  front lip with repeated shallow teeth, and a rear upper mounting collar.
- 6310: [Rebrickable photo](https://rebrickable.com/media/parts/photos/14/6310-14-71e5f412-2d6f-44e2-9769-413d5f0b8a86.jpg),
  [seller side photo](https://www.decotoys.ch/images/product_images/original_images/LEGO-Duplo---Toolo-Digger-Bucket-with-3-Teeth-16310-Orange-b.jpg).
  The viewed photos show a thin curved shell, three separated front teeth,
  a raised central neck, and an open C-shaped upper clamp. The existing
  candidate records these features and preserves the local X pivot.
- 4433c01: [BrickArchitect reference](https://brickarchitect.com/parts/4433c01),
  [Bricker photo](https://bricker.info/images/parts/4433c01.png),
  [Rebrickable photo](https://rebrickable.com/media/parts/photos/135/4433c01-135-a5423929-04a5-48d0-be27-9132da2c2ee5.jpg).
  The viewed photos show a perforated cylindrical heat shield, black tubular
  extension, and a right-angle end with a yellow recessed connector. The
  existing mesh already models those visible landmarks; exact hole pitch and
  molded fit remain unmeasured.

## Geometry review

- `6294.dat`: visual shape is consistent with the reference bowl and curved
  cheeks. Pivot `(0,0,0)` and local X interface were unchanged. No scale or
  interface edits were justified by the photos.
- `6310.dat`: existing candidate has closed shell side faces, connected three
  teeth, central neck, and open C-clamp. The focused review in
  `.tmp/special-parts-20261015/6310/REVIEW.md` records the source-page and
  BrickLink evidence plus the known inferred dimensions.
- `4433c01.dat`: existing perforations, axial body, black tip, and yellow end
  detail agree with the viewed references. No reliable multi-angle evidence
  establishes exact hole spacing, wall thickness, or connector tolerance, so
  no geometry was invented.

## Affected course sources

`6294.dat` is referenced by `4-tui-tu-ji.ldr`, `4-xie-zi.ldr`,
`4-yi-long.ldr`, and `4-da-xiang.ldr`; `6310.dat` is referenced by
`4-wa-li.ldr`; `4433c01.dat` is referenced by `4-cha-che.ldr` and
`4-tang-lang.ldr`. These sources were not edited.

## Validation

Standalone wrappers in this directory pass
`check-ldr-collision.mjs` for all three parts (one placement, zero collision
errors each). A local preview rendered `6294.ldr`; the existing 6310 preview
and mesh review are retained in `.tmp/special-parts-20261015/6310/`. The
render helper does not provide a `partpreview` mode; it accepts ordinary LDR
models through the local preview API.

These remain renderer-reviewed local approximations only. Physical fit,
material thickness, tooth profile, hidden retention geometry, and molded
tolerances are not measured or accepted.
