import type { ExperimentKit } from './types'

export function canPreviewMissingKitTable(error: { code?: string } | null): boolean {
  return process.env.NODE_ENV === 'development' && error?.code === 'PGRST205'
}

// Server-only loading: explicitly whitelist display fields; never return procurement data.
export async function localPreviewKits(): Promise<ExperimentKit[]> {
  if (process.env.NODE_ENV !== 'development') return []
  const { default: source } = await import('@/data/store/science-kits-source.json')
  return source.variants.map(v => ({
    id: v.kitId, slug: v.slug, name: v.name,
    kind: v.kind as ExperimentKit['kind'], revision: 1, status: 'draft',
    cover_url: v.coverUrl, gallery_urls: v.galleryUrls, materials: v.materials,
    catalog: 'catalog' in v ? v.catalog ?? [] : [], preparation_note: v.preparationNote,
    localPreview: true,
  }))
}
