/**
 * Scratch 默认工程常用素材（小猫造型 + 喵声 + 空白舞台）。
 * 在 GUI 启动早期预取，减少「框出来了、图还在转」的空窗。
 */
export const DEFAULT_SCRATCH_ASSET_MD5EXTS = [
  // default project: cat costumes + pop/meow + blank backdrop
  'bcf454acf82e4504149f7ffe07081dbc.svg',
  '0fb9be3e8397c983338cb71dc84d0b25.svg',
  '83a9787d4cb6f3b7632b4ddfebf74367.wav',
  '83c36d806dc92327b9e7049a565c6bff.wav',
  'cd21514d0531fdffb22204e0ec5ed84a.svg',
]

export function prefetchScratchAssets(md5exts = DEFAULT_SCRATCH_ASSET_MD5EXTS) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return

  for (const md5ext of md5exts) {
    const url = `/internalapi/asset/${md5ext}/get/`
    // 不 await：与 GUI 启动并行；失败忽略
    void fetch(url, { credentials: 'same-origin' }).catch(() => {})
  }
}
