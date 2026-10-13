import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Leaf } from 'lucide-react'

import type { SpeciesAtlasTopicFilter } from '@/lib/nature-species-atlas'
import styles from './species-atlas.module.css'

// 复用站内专题封面；仅作装饰，不把封面包装成某次真实观察。
const TOPICS = {
  all: { image: '/assets/nature-topic-plants.webp', summary: '认识身边的鸟类、昆虫和植物，留下自己的发现。' },
  birds: { image: '/assets/nature-topic-birds.webp', summary: '认识身边的鸟类，记录每一次发现。' },
  insects: { image: '/assets/nature-topic-insects.webp', summary: '看看小小昆虫的细节，发现身边的生命。' },
  plants: { image: '/assets/nature-topic-plants.webp', summary: '认识一株植物，观察四季里的变化。' },
} satisfies Record<SpeciesAtlasTopicFilter, { image: string; summary: string }>

export function SpeciesAtlasHero({ topic, heading, introduction }: {
  topic: SpeciesAtlasTopicFilter
  heading: string
  introduction: string
}) {
  const appearance = TOPICS[topic]
  return (
    <header className={styles.hero}>
      <Image src={appearance.image} alt="" fill priority sizes="(max-width: 767px) 100vw, 1800px" className={styles.heroImage} />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.heroContent}>
        <p className={styles.kicker}><Leaf size={14} aria-hidden="true" />发现身边的自然</p>
        <h1>{heading}</h1>
        <p className={styles.mobileIntroduction}>{appearance.summary}</p>
        <p className={styles.desktopIntroduction}>{introduction}</p>
        <Link href="/nature/observations" className={styles.heroAction}>
          查看公开观察记录<ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </header>
  )
}
