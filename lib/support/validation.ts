import type { SupportChannel } from './channels'

export class SupportError extends Error {
  constructor(message: string, public statusCode = 400) { super(message) }
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new SupportError('无效的标识')
  return value
}
export function imageMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new SupportError('图片不能超过 5 MB')
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i]===v)) return 'image/png'
  if (bytes.length >= 4 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes[bytes.length-2]===255 && bytes[bytes.length-1]===217) return 'image/jpeg'
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'image/webp'
  throw new SupportError('请选择 JPEG、PNG 或 WebP 图片')
}
export function cursor(value: string | null) {
  if (value === null || value === '') return null
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0) throw new SupportError('无效的消息位置')
  return n
}

export function supportChannel(value: unknown): SupportChannel {
  if (value === undefined || value === null) return 'platform'
  if (value !== 'platform' && value !== 'store') throw new SupportError('无效的客服频道')
  return value
}

export function channelFromSearch(search: URLSearchParams): SupportChannel {
  if (search.getAll('channel').length > 1) throw new SupportError('不能重复指定客服频道')
  return supportChannel(search.get('channel'))
}
