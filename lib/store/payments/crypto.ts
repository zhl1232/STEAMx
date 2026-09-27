import { createDecipheriv, createVerify, timingSafeEqual } from 'node:crypto'

export function verifyRsaSha256(
  publicKey: string,
  message: string,
  signature: string,
): boolean {
  if (!signature) return false
  const v = createVerify('RSA-SHA256')
  v.update(message)
  v.end()
  try {
    return v.verify(publicKey, Buffer.from(signature, 'base64'))
  } catch {
    return false
  }
}
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
export function decryptWechatNotification(
  ciphertext: string,
  nonce: string,
  associatedData: string,
  key: string | Buffer,
): string {
  const raw = Buffer.from(ciphertext, 'base64')
  if (raw.length < 17) throw new Error('invalid WeChat ciphertext')
  const decipher = createDecipheriv(
    'aes-256-gcm',
    typeof key === 'string' ? Buffer.from(key, 'utf8') : key,
    Buffer.from(nonce, 'utf8'),
  )
  decipher.setAAD(Buffer.from(associatedData, 'utf8'))
  decipher.setAuthTag(raw.subarray(raw.length - 16))
  return Buffer.concat([
    decipher.update(raw.subarray(0, -16)),
    decipher.final(),
  ]).toString('utf8')
}
export function decodeApiV3Key(value: string): Buffer {
  return /^[\da-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'utf8')
}
