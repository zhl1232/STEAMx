import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type StoreAddressPayload = {
  recipientName: string
  phone: string
  province: string
  city: string
  district: string
  street: string
  postalCode?: string
}

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

function getKey() {
  const raw = process.env.STORE_ADDRESS_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error('Missing STORE_ADDRESS_ENCRYPTION_KEY')

  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('STORE_ADDRESS_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex)')
  }
  return key
}

export function encryptStoreAddress(payload: StoreAddressPayload) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptStoreAddress(value: string): StoreAddressPayload {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.')
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted store address')
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
  const parsed = JSON.parse(plaintext) as Partial<StoreAddressPayload>
  if (
    typeof parsed.recipientName !== 'string' ||
    typeof parsed.phone !== 'string' ||
    typeof parsed.province !== 'string' ||
    typeof parsed.city !== 'string' ||
    typeof parsed.district !== 'string' ||
    typeof parsed.street !== 'string'
  ) {
    throw new Error('Invalid store address payload')
  }
  return parsed as StoreAddressPayload
}

export function maskRecipientName(value: string) {
  const chars = [...value.trim()]
  if (chars.length <= 1) return '*'
  return `${chars[0]}${'*'.repeat(Math.max(1, chars.length - 1))}`
}

export function phoneLast4(value: string) {
  return value.replace(/\D/g, '').slice(-4).padStart(4, '0')
}
