import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'

const MAX_MAP_TILE_IMAGES = 128
const tileImages = new BoundedTtlMap<string, HTMLImageElement>(MAX_MAP_TILE_IMAGES)

/** Share decoded map tiles across map views without retaining an unbounded pan history. */
export function getMapTileImage(src: string): HTMLImageElement {
  const cached = tileImages.get(src)
  if (cached) return cached

  const image = new window.Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.src = src
  tileImages.set(src, image, Number.POSITIVE_INFINITY)
  return image
}
