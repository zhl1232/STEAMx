# Hook, pulley, and roll-cage review (2026-10-15)

Scope is limited to:

- `s/steamx-75536-hook.dat`
- `s/steamx-14013c01-hook.dat`
- `dev-129/6295-ta-diao.dat`
- `dev-129/45146-shou-ge-ji.dat`

No target geometry was changed. The review found the visible landmarks already
represented, while exact molded dimensions and interface tolerances remain
unmeasured.

## Evidence checked

- 75536 hook: official local `scripts/ldraw-models/parts/4663.dat`, plus
  [BrickLink hook catalog](https://www.bricklink.com/catalogList.asp?catLike=W&pg=1&q=hook&v=1).
  The delegated subpart is already a direct `4663.dat` reference, which is the
  official hook geometry and preserves the existing string-eye origin.
- 14013c01: [BrickReport inventory reference](https://www.brickreport.io/sets/10508-1-deluxe-train-set),
  [black/gray winch seller photo](https://www.pracht-steine.de/storage/images/image?remote=https%3A%2F%2Fwww.pracht-steine.de%2FWebRoot%2FStore18%2FShops%2F64622495%2F5AEC%2F7034%2FA8D0%2FF0EB%2F6FCA%2F0A0C%2F6D0A%2FD135%2FIMG-4854.JPG&shop=64622495).
  The existing subpart has the long cylindrical black hook body and rounded
  end treatment visible in the reference; no reliable source gave exact hook
  opening or axle fit dimensions.
- 6295: [BrickArchitect reference](https://brickarchitect.com/parts/6295),
  [BrickLink photo](https://www.bricklink.com/PL/6295.jpg),
  [seller photo](https://www.steinpalast.eu/media/image/d6/26/c9/37473g887IED92Wlw.jpg).
  These show the circular fake pulley, central hole, broad molded arm, and
  smooth open hook. The current candidate already contains a circular pulley
  region, hook opening, and the existing Z-axis pivot; exact molded recess
  depth is not documented.
- 45146: [BrickLink catalog](https://www.bricklink.com/v2/catalog/catalogitem.page?P=45146&idColor=66),
  [seller photo](https://www.steinpalast.eu/media/image/80/e9/e6/9184fTumWSaJcQt1Z_600x600.jpg).
  The current cage has the same closed overhead frame, front windshield bar,
  side rails, and two bottom rails. The photo confirms the rounded tube look,
  but does not provide enough dimensions to replace the existing inferred
  origin-matched cage safely.

## Render and geometry review

Standalone wrappers for all four targets passed
`check-ldr-collision.mjs` (one placement, zero errors each). The normal local
render helper does not support `partpreview` and cannot resolve these custom
part paths as isolated models; course-level renders were used instead:
`4-ta-diao.ldr` shows the 6295 pulley/hook assembly, `4-shou-ge-ji.ldr` shows
the 45146 cage, and `4-long-men-diao.ldr` shows the 14013 winch context. The
official 4663 dependency is retained by the 75536 wrapper.

## Affected course sources

References were found in `4-long-men-diao.ldr`, `4-shou-ge-ji.ldr`,
`4-ta-diao.ldr`, `5-chou-you-ji.ldr`, `5-diao-che.ldr`, `5-lan-che.ldr`,
`5-long-men-diao.ldr`, `5-ma-tou-diao-ji.ldr`, `5-re-qi-qiu.ldr`,
`5-sheng-jiang-dian-ti.ldr`, `5-shui-jing.ldr`, `5-shui-zha.ldr`,
`5-ta-diao.ldr`, and `5-ti-xian-mu-ou.ldr`. No course LDR or shared metadata
was edited.

Remaining risk is renderer-only confidence: hook curvature, pulley recess,
roll-cage tube diameter, hidden retention, and physical fit are not measured.
