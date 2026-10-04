import { describe, expect, it } from 'vitest'

import { readObservationPhotoMetadata } from './observation-photo-metadata'

// Real binary EXIF, with public synthetic coordinates. No phone photos or mocks
// of the EXIF parser: exercise the same bytes for JPEG, PNG and WebP.
function gpsTiff() {
  const tiff = Buffer.alloc(128)
  tiff.write('II')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(1, 8)
  const entry = (offset: number, tag: number, type: number, count: number, value: number) => {
    tiff.writeUInt16LE(tag, offset)
    tiff.writeUInt16LE(type, offset + 2)
    tiff.writeUInt32LE(count, offset + 4)
    tiff.writeUInt32LE(value, offset + 8)
  }
  entry(10, 0x8825, 4, 1, 26)
  tiff.writeUInt16LE(4, 26)
  entry(28, 1, 2, 2, 78) // N
  entry(40, 2, 5, 3, 80)
  entry(52, 3, 2, 2, 69) // E
  entry(64, 4, 5, 3, 104)
  for (const [offset, parts] of [[80, [31, 12, 0]], [104, [121, 30, 0]]] as const) {
    parts.forEach((value, index) => {
      tiff.writeUInt32LE(value, offset + index * 8)
      tiff.writeUInt32LE(1, offset + index * 8 + 4)
    })
  }
  return tiff
}

function jpeg(withGps: boolean) {
  if (!withGps) return Buffer.from([0xff, 0xd8, 0xff, 0xd9])
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), gpsTiff()])
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 0])
  header.writeUInt16BE(exif.length + 2, 4)
  return Buffer.concat([header, exif, Buffer.from([0xff, 0xd9])])
}

function webp(exif?: Buffer) {
  const chunks = exif ? Buffer.concat([
    Buffer.from('EXIF'),
    Buffer.from([exif.length, 0, 0, 0]),
    exif,
    exif.length % 2 ? Buffer.from([0]) : Buffer.alloc(0),
  ]) : Buffer.alloc(0)
  const header = Buffer.alloc(12)
  header.write('RIFF')
  header.writeUInt32LE(chunks.length + 4, 4)
  header.write('WEBP', 8)
  return Buffer.concat([header, chunks])
}

function png() {
  const chunk = (name: string, value: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(value.length)
    return Buffer.concat([length, Buffer.from(name), value, Buffer.alloc(4)])
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('eXIf', gpsTiff()), chunk('IEND', Buffer.alloc(0))])
}

function photo(bytes: Buffer, type = 'image/jpeg') {
  return new File([new Uint8Array(bytes)], 'original-photo', { type })
}

describe('readObservationPhotoMetadata with actual EXIF bytes', () => {
  it.each([
    ['JPEG', () => jpeg(true), 'image/jpeg'],
    ['PNG', png, 'image/png'],
    ['WebP with TIFF', () => webp(gpsTiff()), 'image/webp'],
    ['WebP with Exif prefix', () => webp(Buffer.concat([Buffer.from('Exif\0\0'), gpsTiff()])), 'image/webp'],
  ])('reads GPS from %s original bytes', async (_name, bytes, type) => {
    const result = await readObservationPhotoMetadata(photo(bytes(), type))
    expect(result).toMatchObject({ latitude: 31.2, longitude: 121.5, gpsReadStatus: 'present' })
  })

  it.each([
    ['JPEG', () => jpeg(false), 'image/jpeg'],
    ['WebP', () => webp(), 'image/webp'],
  ])('distinguishes missing GPS in %s from a read failure', async (_name, bytes, type) => {
    expect(await readObservationPhotoMetadata(photo(bytes(), type))).toMatchObject({ latitude: null, longitude: null, gpsReadStatus: 'missing' })
  })

  it('reports corrupt EXIF as unreadable rather than absent GPS', async () => {
    expect(await readObservationPhotoMetadata(photo(webp(Buffer.from('broken EXIF')), 'image/webp'))).toMatchObject({ gpsReadStatus: 'unreadable' })
  })

  it('reads EXIF after an image chunk with RIFF padding', async () => {
    const original = webp(gpsTiff())
    const imageChunk = Buffer.from([86, 80, 56, 32, 1, 0, 0, 0, 0, 0])
    const bytes = Buffer.concat([original.subarray(0, 12), imageChunk, original.subarray(12)])
    bytes.writeUInt32LE(bytes.length - 8, 4)
    expect(await readObservationPhotoMetadata(photo(bytes, 'image/webp'))).toMatchObject({ latitude: 31.2, longitude: 121.5, gpsReadStatus: 'present' })
  })

  it('rejects a truncated WebP container without reporting GPS as absent', async () => {
    const bytes = webp(gpsTiff()).subarray(0, 30)
    expect(await readObservationPhotoMetadata(photo(bytes, 'image/webp'))).toMatchObject({ gpsReadStatus: 'unreadable' })
  })

  it('reports a provider read failure without claiming GPS is absent', async () => {
    const file = photo(jpeg(true))
    Object.defineProperty(file, 'arrayBuffer', { value: async () => { throw new Error('provider denied read') } })
    expect(await readObservationPhotoMetadata(file)).toMatchObject({ gpsReadStatus: 'unreadable' })
  })

  it('identifies unsupported GIF metadata separately from missing GPS', async () => {
    expect(await readObservationPhotoMetadata(photo(Buffer.from('GIF89a'), 'image/gif'))).toMatchObject({ gpsReadStatus: 'unsupported_format' })
  })
})
