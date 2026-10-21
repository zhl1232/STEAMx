/**
 * 去掉上传图片里的位置等元数据（第 15 条：照片 EXIF GPS 同样不能公开）。
 * - JPEG：删除所有 APP1(Exif/XMP) 段；如原 EXIF 有方向标记，补一个只含 Orientation 的最小 EXIF，避免图片转向。
 * - PNG：删除 eXIf / iTXt / tEXt / zTXt 块。
 * - WebP：删除 EXIF / XMP 块（不调整 VP8X 标志位，解码器会忽略缺失块）。
 * 其它格式原样返回。纯字节处理，不重新编码，不损失画质。
 */
export function stripImageLocationMetadata(input: Uint8Array, mime: string): Uint8Array {
  try {
    if (mime === 'image/jpeg') return stripJpeg(input)
    if (mime === 'image/png') return stripPng(input)
    if (mime === 'image/webp') return stripWebp(input)
  } catch {
    // 解析失败时返回原图：上传不应因元数据处理失败而中断。
  }
  return input
}

function readOrientation(segment: Uint8Array): number | null {
  // segment: 从 "Exif\0\0" 开始
  if (segment.length < 14) return null
  const tiff = 6
  const little = segment[tiff] === 0x49 && segment[tiff + 1] === 0x49
  const view = new DataView(segment.buffer, segment.byteOffset, segment.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, little)
  const u32 = (offset: number) => view.getUint32(offset, little)
  const ifd0 = tiff + u32(tiff + 4)
  if (ifd0 + 2 > segment.length) return null
  const count = u16(ifd0)
  for (let index = 0; index < count; index += 1) {
    const entry = ifd0 + 2 + index * 12
    if (entry + 12 > segment.length) return null
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8)
      return value >= 1 && value <= 8 ? value : null
    }
  }
  return null
}

function minimalOrientationApp1(orientation: number): Uint8Array {
  const body = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // big-endian TIFF, IFD0 at 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ]
  const length = body.length + 2
  return Uint8Array.from([0xff, 0xe1, length >> 8, length & 0xff, ...body])
}

function stripJpeg(input: Uint8Array): Uint8Array {
  if (input[0] !== 0xff || input[1] !== 0xd8) return input
  const parts: Uint8Array[] = [input.subarray(0, 2)]
  let orientation: number | null = null
  let offset = 2
  let removed = false
  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) return input
    const marker = input[offset + 1]
    // SOS：之后是压缩数据，原样保留到结尾
    if (marker === 0xda) {
      parts.push(input.subarray(offset))
      offset = input.length
      break
    }
    const length = (input[offset + 2] << 8) | input[offset + 3]
    const end = offset + 2 + length
    if (length < 2 || end > input.length) return input
    const segment = input.subarray(offset, end)
    if (marker === 0xe1) {
      const payload = segment.subarray(4)
      const isExif = payload[0] === 0x45 && payload[1] === 0x78 && payload[2] === 0x69 && payload[3] === 0x66
      if (isExif && orientation === null) orientation = readOrientation(payload)
      removed = true
    } else {
      parts.push(segment)
    }
    offset = end
  }
  if (!removed) return input
  if (orientation && orientation !== 1) parts.splice(1, 0, minimalOrientationApp1(orientation))
  return concat(parts)
}

function stripPng(input: Uint8Array): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!signature.every((byte, index) => input[index] === byte)) return input
  const drop = new Set(['eXIf', 'iTXt', 'tEXt', 'zTXt'])
  const parts: Uint8Array[] = [input.subarray(0, 8)]
  let offset = 8
  let removed = false
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  while (offset + 12 <= input.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...input.subarray(offset + 4, offset + 8))
    const end = offset + 12 + length
    if (end > input.length) return input
    if (drop.has(type)) removed = true
    else parts.push(input.subarray(offset, end))
    offset = end
  }
  return removed ? concat(parts) : input
}

function stripWebp(input: Uint8Array): Uint8Array {
  const tag = (offset: number) => String.fromCharCode(...input.subarray(offset, offset + 4))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return input
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  const parts: Uint8Array[] = []
  let offset = 12
  let removed = false
  while (offset + 8 <= input.length) {
    const size = view.getUint32(offset + 4, true)
    const end = offset + 8 + size + (size % 2)
    if (end > input.length) return input
    const type = tag(offset)
    if (type === 'EXIF' || type === 'XMP ') removed = true
    else parts.push(input.subarray(offset, end))
    offset = end
  }
  if (!removed) return input
  const body = concat(parts)
  const header = new Uint8Array(12)
  header.set(input.subarray(0, 12))
  new DataView(header.buffer).setUint32(4, body.length + 4, true)
  return concat([header, body])
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}
