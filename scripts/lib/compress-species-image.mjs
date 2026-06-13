/** 物种图集存储规格：对齐 OptimizedImage cover 最大宽度 1280px */
export const SPECIES_IMAGE_MAX_SIDE = 1280
export const SPECIES_IMAGE_JPEG_QUALITY = 80
export const SPECIES_IMAGE_WEBP_QUALITY = 80

export async function compressSpeciesImageFile(filePath, sharpModule, options = {}) {
  const sharp = sharpModule?.default ?? sharpModule
  if (!sharp) throw new Error('sharp is required')

  const maxSide = options.maxSide ?? SPECIES_IMAGE_MAX_SIDE
  const jpegQuality = options.jpegQuality ?? SPECIES_IMAGE_JPEG_QUALITY
  const webpQuality = options.webpQuality ?? SPECIES_IMAGE_WEBP_QUALITY
  const lowerPath = filePath.toLowerCase()

  let pipeline = sharp(filePath)
  const meta = await pipeline.metadata()
  const width = meta.width || maxSide
  const height = meta.height || maxSide

  if (width > maxSide || height > maxSide) {
    pipeline = pipeline.resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
  }

  if (lowerPath.endsWith('.png')) {
    pipeline = pipeline.png({ compressionLevel: 8, effort: 9 })
  } else if (lowerPath.endsWith('.webp')) {
    pipeline = pipeline.webp({ quality: webpQuality })
  } else {
    pipeline = pipeline.jpeg({ quality: jpegQuality, mozjpeg: true })
  }

  const buf = await pipeline.toBuffer()
  const { writeFileSync } = await import('node:fs')
  writeFileSync(filePath, buf)
  return buf.length
}
