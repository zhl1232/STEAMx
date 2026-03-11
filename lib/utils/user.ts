const PLACEHOLDER_EMAIL_SUFFIX = '@phone.local'

export function isPlaceholderEmail(email?: string | null): boolean {
  return !!email && email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)
}

export function getPublicEmail(email?: string | null): string | null {
  if (!email || isPlaceholderEmail(email)) return null
  return email
}

export function getDisplayName(options: {
  profileName?: string | null
  metadataFullName?: string | null
  metadataName?: string | null
  phone?: string | null
  email?: string | null
  fallback?: string
}): string {
  const phoneDisplay = options.phone?.replace(/^\+86/, '') || ''
  const publicEmail = getPublicEmail(options.email)
  const emailName = publicEmail ? publicEmail.split('@')[0] : ''
  return (
    options.profileName ||
    options.metadataFullName ||
    options.metadataName ||
    phoneDisplay ||
    emailName ||
    options.fallback ||
    '用户'
  )
}
