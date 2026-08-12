'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { useEffect, useState } from 'react'

import { saveNatureSpeciesScrollRestore } from '@/lib/nature-species-scroll-restore'
import type { SpeciesAtlasItem } from '@/lib/nature-species-atlas'
import { resolveAssetDisplayUrl, shouldBypassAssetDisplayOptimization } from '@/lib/utils/asset-url'
import { appendNatureFrom } from '@/lib/utils/nature-navigation'
import { cn } from '@/lib/utils'

interface SpeciesAtlasTileProps {
  item: SpeciesAtlasItem
  fromHref: string
  filtersKey: string
  priority?: boolean
}

export function SpeciesAtlasTile({ item, fromHref, filtersKey, priority = false }: SpeciesAtlasTileProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const imageSrc = resolveAssetDisplayUrl(item.thumbnailUrl) ?? item.thumbnailUrl
  const showImage = Boolean(imageSrc) && !failed
  const topicLabel = item.topicKey === 'birds' ? '鸟类' : item.topicKey === 'insects' ? '昆虫' : '植物'
  const statusLabel = item.observedByCurrentUser === true
    ? '已观察'
    : item.observedByCurrentUser === false
      ? '待观察'
      : '观察状态未知'
  const href = appendNatureFrom(`/nature/species/${item.slug}`, fromHref)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [item.thumbnailUrl])

  function saveScrollPosition(element: HTMLElement) {
    if (typeof window === 'undefined') return

    saveNatureSpeciesScrollRestore({
      filtersKey,
      scrollY: window.scrollY,
      anchorSlug: item.slug,
      anchorTop: element.getBoundingClientRect().top,
    })
  }

  return (
    <Link
      href={href}
      prefetch={false}
      data-species-slug={item.slug}
      className={cn(
        'nature-atlas-tile group',
        item.observedByCurrentUser === true && 'nature-atlas-tile-observed',
      )}
      aria-label={`${item.commonName}，${topicLabel}，${statusLabel}`}
      title={item.scientificName || item.commonName}
      onPointerDown={(event) => saveScrollPosition(event.currentTarget)}
    >
      <span className="nature-atlas-tile-media" aria-hidden="true">
        {showImage ? (
          <Image
            src={imageSrc as string}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 639px) 22vw, (max-width: 1023px) 92px, 112px"
            unoptimized={shouldBypassAssetDisplayOptimization(item.thumbnailUrl)}
            className={cn(
              'object-cover transition-opacity duration-300',
              item.observedByCurrentUser !== true && 'grayscale saturate-25 opacity-75',
              loaded ? (item.observedByCurrentUser === true ? 'opacity-100' : 'opacity-75') : 'opacity-0',
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <CircleHelp className="h-7 w-7 text-muted-foreground/75" strokeWidth={1.7} />
        )}
      </span>

      <span className="nature-atlas-tile-name">
        <span className="line-clamp-2">{item.commonName}</span>
        <span className="sr-only">{statusLabel}</span>
      </span>
    </Link>
  )
}
