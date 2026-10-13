'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Bird, Bug, Check, Sprout } from 'lucide-react'
import { memo, useState } from 'react'

import { saveNatureSpeciesScrollRestore } from '@/lib/nature-species-scroll-restore'
import type { SpeciesAtlasItem } from '@/lib/nature-species-atlas'
import { resolveAssetDisplayUrl, shouldBypassAssetDisplayOptimization } from '@/lib/utils/asset-url'
import { cn } from '@/lib/utils'
import styles from './species-atlas.module.css'

interface SpeciesAtlasTileProps {
  item: SpeciesAtlasItem
  filtersKey: string
  priority?: boolean
}

export const SpeciesAtlasTile = memo(function SpeciesAtlasTile({ item, filtersKey, priority = false }: SpeciesAtlasTileProps) {
  // 失败状态绑定图片地址，不为每张图片安装 effect 或在 onLoad 后再次渲染。
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imageSrc = resolveAssetDisplayUrl(item.thumbnailUrl) ?? item.thumbnailUrl
  const showImage = Boolean(imageSrc) && failedSrc !== imageSrc
  const topicLabel = item.topicKey === 'birds' ? '鸟类' : item.topicKey === 'insects' ? '昆虫' : '植物'
  const statusLabel = item.observedByCurrentUser === true
    ? '已观察'
    : item.observedByCurrentUser === false
      ? '待观察'
      : '观察状态未知'
  const href = `/nature/species/${item.slug}`
  const PlaceholderIcon = item.topicKey === 'birds' ? Bird : item.topicKey === 'insects' ? Bug : Sprout

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
      className={cn('nature-atlas-tile group', item.observedByCurrentUser === true && 'nature-atlas-tile-observed')}
      aria-label={`${item.commonName}，${topicLabel}，${statusLabel}`}
      title={item.scientificName || item.commonName}
      onClick={(event) => saveScrollPosition(event.currentTarget)}
    >
      <span className="nature-atlas-tile-media" aria-hidden="true">
        {showImage ? (
          <Image
            src={imageSrc as string}
            alt=""
            fill
            priority={priority}
            decoding="async"
            sizes="(max-width: 767px) 45vw, (max-width: 1279px) 25vw, 240px"
            unoptimized={shouldBypassAssetDisplayOptimization(item.thumbnailUrl)}
            className="object-cover"
            onError={() => setFailedSrc(imageSrc)}
          />
        ) : (
          <span className={styles.placeholder}><PlaceholderIcon size={28} strokeWidth={1.5} /><span>暂无图片</span></span>
        )}
        {item.observedByCurrentUser !== null ? (
          <span className={cn(styles.badge, item.observedByCurrentUser && styles.observedBadge)}>
            {item.observedByCurrentUser ? <Check size={11} aria-hidden="true" /> : null}{statusLabel}
          </span>
        ) : null}
      </span>
      <span className={styles.tileInfo}>
        <span className="nature-atlas-tile-name" title={item.commonName}>{item.commonName}</span>
        {item.scientificName ? <i className={styles.scientificName} title={item.scientificName}>{item.scientificName}</i> : null}
        {item.taxonGroup ? <span className={styles.taxonGroup} title={item.taxonGroup}>{item.taxonGroup}</span> : null}
        <span className="sr-only">{statusLabel}</span>
      </span>
    </Link>
  )
})
