import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const VERSION = 'v1'

function getKey() {
  const raw = process.env.STORE_ALIBABA_TOKEN_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error('Missing STORE_ALIBABA_TOKEN_ENCRYPTION_KEY')
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('STORE_ALIBABA_TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 or 64-char hex)')
  }
  return key
}

export function encryptStoreSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptStoreSecret(value: string) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = value.split('.')
  if (version !== VERSION || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error('Invalid encrypted store secret')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivEncoded, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
