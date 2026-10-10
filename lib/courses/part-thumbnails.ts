import manifest from './part-thumbnails.json'

export interface PartThumbnail {
  src: string
  /** false 表示图片是同形状的其它颜色，页面需叠加真实色块 */
  exactColor: boolean
}

const thumbnails = manifest as Record<string, PartThumbnail>

/** 本地缓存的 Rebrickable 零件图（由 scripts/fetch-part-thumbnails.py 生成）；没有时返回 null。 */
export function getPartThumbnail(partId: string, colorCode: number): PartThumbnail | null {
  return thumbnails[`${partId}|${colorCode}`] ?? null
}
