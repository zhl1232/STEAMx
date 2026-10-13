import Image from 'next/image'
import { Leaf } from 'lucide-react'

import type { SpeciesAtlasTopicFilter } from '@/lib/nature-species-atlas'
import styles from './species-atlas.module.css'

/**
 * 头图：普通翠鸟（Alcedo atthis），摄影 Andreas Trepte（photo-natur.de），
 * 来源 Wikimedia Commons「File:Common_Kingfisher_Alcedo_atthis.jpg」，
 * 许可 CC BY-SA 2.5（https://creativecommons.org/licenses/by-sa/2.5/）。
 * 已改为 1800×1000 宽幅合成（原图背景虚化延展、翠鸟置右、整体色调略偏绿），webp；按许可要求在头图角落署名。
 */
const HERO_PHOTO = {
  src: '/assets/nature-atlas-hero-kingfisher-v3.webp',
  credit: '图：Andreas Trepte / CC BY-SA 2.5',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Common_Kingfisher_Alcedo_atthis.jpg',
}

const SUMMARIES: Record<SpeciesAtlasTopicFilter, string> = {
  all: '认识身边的鸟类、昆虫和植物，留下自己的发现。',
  birds: '认识常见鸟类，学习识别特征\n查看社区的真实观察内容',
  insects: '看看小小昆虫的细节，发现身边的生命。',
  plants: '认识一株植物，观察四季里的变化。',
}

const UNIT: Record<SpeciesAtlasTopicFilter, string> = { all: '物种总数', birds: '鸟类总数', insects: '昆虫总数', plants: '植物总数' }

const UNIT_SHORT: Record<SpeciesAtlasTopicFilter, string> = { all: '种物种', birds: '种鸟类', insects: '种昆虫', plants: '种植物' }

export function SpeciesAtlasHero({ topic, heading, stats, children }: {
  topic: SpeciesAtlasTopicFilter
  heading: string
  introduction?: string
  /** 均由图鉴数据计算；observed 为 null 表示未登录或进度不可用。 */
  stats: { total: number; observed: number | null; unobserved: number | null }
  /** 手机端透明顶栏，叠在照片上。 */
  children?: React.ReactNode
}) {
  return (
    <header className={styles.hero}>
      <Image src={HERO_PHOTO.src} alt="停在树枝上的普通翠鸟" fill priority sizes="100vw" className={styles.heroImage} />
      <div className={styles.heroShade} aria-hidden="true" />
      {children}
      <div className={styles.heroContent}>
        <p className={styles.kicker}><Leaf size={14} aria-hidden="true" />发现身边的自然</p>
        <h1>{heading}</h1>
        <p className={styles.heroIntro}>{SUMMARIES[topic]}</p>
        <dl className={styles.heroStats}>
          <div><dd>{stats.total}</dd><dt>{UNIT_SHORT[topic]}</dt></div>
          <div><dd>{stats.observed ?? '—'}</dd><dt>已观察</dt></div>
          <div><dd>{stats.unobserved ?? '—'}</dd><dt>待观察</dt></div>
        </dl>
      </div>
      <a href={HERO_PHOTO.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.heroCredit}>{HERO_PHOTO.credit}</a>
    </header>
  )
}
