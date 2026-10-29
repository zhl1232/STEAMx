import { expect, it } from 'vitest'
import { getPartThumbnail } from './part-thumbnails'

it.each([7, 71])('uses the model geometry in the requested gray for screw brick color %s', (color) => {
  expect(getPartThumbnail('76057.dat', color)).toEqual({
    src: `/courses/part-thumbs/model-76057-${color}.webp`,
    exactColor: true,
  })
})
