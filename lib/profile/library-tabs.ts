export const PROFILE_LIBRARY_TABS = [
  'works',
  'collected',
  'likes',
  'exploring',
  'completed',
  'observations',
] as const

export type ProfileLibraryTab = (typeof PROFILE_LIBRARY_TABS)[number]

export type DesktopProfileLibraryTab =
  | 'my-projects'
  | 'collected'
  | 'liked'
  | 'exploring'
  | 'completed'
  | 'observations'

const PROFILE_LIBRARY_TAB_SET = new Set<string>(PROFILE_LIBRARY_TABS)

function firstParam(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export function parseProfileLibraryTab(value: string | string[] | null | undefined): ProfileLibraryTab {
  const tab = firstParam(value)
  return tab && PROFILE_LIBRARY_TAB_SET.has(tab) ? (tab as ProfileLibraryTab) : 'works'
}

export function toDesktopProfileLibraryTab(tab: ProfileLibraryTab): DesktopProfileLibraryTab {
  if (tab === 'works') return 'my-projects'
  if (tab === 'likes') return 'liked'
  return tab
}

export function toProfileLibraryTab(tab: DesktopProfileLibraryTab): ProfileLibraryTab {
  if (tab === 'my-projects') return 'works'
  if (tab === 'liked') return 'likes'
  return tab
}
