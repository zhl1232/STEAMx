const DISPLAY_NAME_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DISPLAY_NAME_SUFFIX_LENGTH = 4

export function createDefaultDisplayName(randomBytes?: Uint8Array): string {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(DISPLAY_NAME_SUFFIX_LENGTH))

  if (bytes.length < DISPLAY_NAME_SUFFIX_LENGTH) {
    throw new Error(`Default display name requires ${DISPLAY_NAME_SUFFIX_LENGTH} random bytes`)
  }

  let suffix = ''
  for (let index = 0; index < DISPLAY_NAME_SUFFIX_LENGTH; index += 1) {
    suffix += DISPLAY_NAME_ALPHABET[bytes[index] % DISPLAY_NAME_ALPHABET.length]
  }

  return `新用户${suffix}`
}

export function isPhoneBasedDisplayName(displayName: string | null | undefined, phone: string): boolean {
  if (!displayName) return false

  const nameDigits = displayName.replace(/\D/g, '')
  const phoneDigits = phone.replace(/\D/g, '')

  return (
    nameDigits.length >= 11 &&
    (nameDigits === phoneDigits || phoneDigits.endsWith(nameDigits) || nameDigits.endsWith(phoneDigits))
  )
}
