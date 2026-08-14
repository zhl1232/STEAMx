import type { ProjectStep } from "@/lib/mappers/types"

export type HeroGalleryItem = {
  url: string
  caption?: string
}

export function collectHeroGalleryImages(
  coverImage: string | null | undefined,
  steps: Array<Pick<ProjectStep, "title" | "image_url">> = [],
  options?: { coverCaption?: string },
): HeroGalleryItem[] {
  const seen = new Set<string>()
  const items: HeroGalleryItem[] = []

  const add = (url: string | null | undefined, caption?: string) => {
    const normalized = url?.trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    const trimmedCaption = caption?.trim()
    items.push(trimmedCaption ? { url: normalized, caption: trimmedCaption } : { url: normalized })
  }

  add(coverImage, options?.coverCaption)
  for (const step of steps) {
    add(step.image_url, step.title)
  }

  return items
}
