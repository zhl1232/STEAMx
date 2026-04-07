export const DEFAULT_AVATAR_FILES = [
  'default-1.svg',
  'default-2.svg',
  'default-3.svg',
  'default-4.svg',
  'default-5.svg',
  'default-6.svg',
  'default-7.svg',
  'default-8.svg',
  'default-9.svg',
  'default-10.svg',
  'default-11.svg',
  'default-12.svg',
] as const

export const DEFAULT_AVATAR_PATHS = DEFAULT_AVATAR_FILES.map(
  (filename) => `/avatars/${filename}`,
)

const DEFAULT_AVATAR_PATH_SET = new Set<string>(DEFAULT_AVATAR_PATHS)

export function isDefaultAvatarPath(value: string) {
  return DEFAULT_AVATAR_PATH_SET.has(value)
}

function hashSeed(seed: string) {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

export function getDefaultAvatarPath(seed?: string | null) {
  if (!seed) {
    return DEFAULT_AVATAR_PATHS[0]
  }

  return DEFAULT_AVATAR_PATHS[hashSeed(seed) % DEFAULT_AVATAR_PATHS.length]
}
