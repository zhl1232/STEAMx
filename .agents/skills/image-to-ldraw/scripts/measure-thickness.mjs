#!/usr/bin/env node
// Classify a Duplo brick-vs-plate instruction icon as thick or thin from measured pixel
// dimensions of its front face. See references/thickness-review.md for the full workflow
// (how to render the source page, how to crop, which face to measure).
//
// Usage:
//   node measure-thickness.mjs --height=88 --width=120
//   node measure-thickness.mjs --height=88 --width=120 --thick-ratio=0.74 --thin-ratio=0.60
//
// height/width: pixel measurements of the FRONT FACE only (not the top stud face or an angled
// side face) of a single brick/plate icon, taken from a tight crop of the source instruction page.
//
// thick-ratio/thin-ratio: optional calibration ratios measured from a KNOWN brick icon and a
// KNOWN plate icon elsewhere in the SAME source document. The defaults (0.73 / 0.62) came from
// the 宝剑 instructions.pdf legend and are a starting point only -- icon proportions vary between
// PDF authors/renderers, so recalibrate per document whenever an unambiguous reference icon is
// available.

function parseArgs(argv) {
  const args = {}
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (!match) continue
    args[match[1]] = match[2]
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const height = Number(args.height)
const width = Number(args.width)

if (!Number.isFinite(height) || !Number.isFinite(width) || width <= 0 || height <= 0) {
  console.error('Usage: node measure-thickness.mjs --height=<px> --width=<px> [--thick-ratio=0.73] [--thin-ratio=0.62]')
  process.exit(1)
}

const thickRatio = args['thick-ratio'] ? Number(args['thick-ratio']) : 0.73
const thinRatio = args['thin-ratio'] ? Number(args['thin-ratio']) : 0.62
if (thickRatio <= thinRatio) {
  console.error('--thick-ratio must be greater than --thin-ratio')
  process.exit(1)
}

const ratio = height / width
const midpoint = (thickRatio + thinRatio) / 2
// Anything within a quarter of the thick/thin gap from the midpoint is too close to call
// automatically -- that is a prompt to lower confidence and set needsReview, not to guess.
const ambiguousBand = (thickRatio - thinRatio) / 4

console.log(`ratio = ${ratio.toFixed(3)}  (height ${height}px / width ${width}px)`)
console.log(`reference: thick≈${thickRatio}, thin≈${thinRatio}, midpoint=${midpoint.toFixed(3)}`)

if (Math.abs(ratio - midpoint) < ambiguousBand) {
  console.log(
    '=> AMBIGUOUS: too close to the midpoint between references. Re-crop tighter to the front '
    + 'face only, or find a clearer same-document calibration icon. Do not guess -- lower '
    + 'confidence and set needsReview: true instead.',
  )
} else if (ratio > midpoint) {
  console.log('=> Looks THICK (brick-height part, e.g. 3011.dat / 3437.dat, heightLdu 48).')
} else {
  console.log('=> Looks THIN (plate-height part, e.g. 40666.dat, heightLdu 24).')
}
