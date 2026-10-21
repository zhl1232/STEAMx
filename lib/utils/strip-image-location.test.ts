import { describe, expect, it } from 'vitest'

import { stripImageLocationMetadata } from './strip-image-location'

function exifSegment(orientation: number, withGps = true) {
  // big-endian TIFF, IFD0 with Orientation (+ GPS IFD pointer)
  const entries = withGps ? 2 : 1
  const ifd = [0x00, entries,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    ...(withGps ? [0x88, 0x25, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x30] : []),
    0x00, 0x00, 0x00, 0x00]
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, ...ifd, ...Array.from('GPS40.1N116.3E', (c) => c.charCodeAt(0))]
  return [0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body]
}

const jpeg = (segments: number[]) => Uint8Array.from([0xff, 0xd8, ...segments, 0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9])
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1')

describe('stripImageLocationMetadata', () => {
  it('JPEG：去掉 EXIF（含 GPS），保留方向', () => {
    const output = stripImageLocationMetadata(jpeg(exifSegment(6)), 'image/jpeg')
    expect(text(output)).not.toContain('GPS40.1N')
    expect(text(output)).toContain('Exif')
    expect(Array.from(output.subarray(-8))).toEqual([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9])
  })
  it('JPEG：方向为 1 时不再写 EXIF', () => {
    const output = stripImageLocationMetadata(jpeg(exifSegment(1)), 'image/jpeg')
    expect(text(output)).not.toContain('Exif')
  })
  it('PNG：去掉 eXIf 块', () => {
    const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...Array.from(type, (c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [1, 2]), ...chunk('eXIf', [9, 9, 9]), ...chunk('IEND', [])])
    const output = stripImageLocationMetadata(png, 'image/png')
    expect(text(output)).not.toContain('eXIf')
    expect(text(output)).toContain('IEND')
  })
  it('无法解析时原样返回', () => {
    const junk = Uint8Array.from([1, 2, 3])
    expect(stripImageLocationMetadata(junk, 'image/jpeg')).toBe(junk)
  })
})
