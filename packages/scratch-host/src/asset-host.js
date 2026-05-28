/** Shared asset host helpers for embed vs standalone scratch-host. */

export function isEmbedMode() {
  if (typeof window === 'undefined') return false
  return (
    document.documentElement.dataset.embed === '1' ||
    new URLSearchParams(window.location.search).get('embed') === '1'
  )
}

/**
 * Embed: costumes/sounds via Next `/internalapi/asset` → `public/scratch/assets`.
 * Standalone dev (:8601): MIT CDN (matches unpatched library thumbnails).
 */
export function getAssetHost() {
  if (typeof window === 'undefined') return 'https://assets.scratch.mit.edu'
  if (isEmbedMode() || window.location.pathname.startsWith('/scratch/')) {
    // Relative URLs — works with scratch-storage and avoids worker absolute-URL issues.
    return ''
  }
  return 'https://assets.scratch.mit.edu'
}
