import Image from 'next/image'
import { Leaf } from 'lucide-react'

import type { SpeciesAtlasTopicFilter } from '@/lib/nature-species-atlas'
import styles from './species-atlas.module.css'

interface HeroPhoto { src: string; alt: string; note: string; credits: Array<{ label: string; href: string }> }

const KINGFISHER: HeroPhoto = {
  /* 两张 Wikimedia Commons 图片合成（抠出翠鸟与树枝、水平翻转、叠到虚化枫叶背景上），合成图按 CC BY-SA 2.0 提供：
   * 翠鸟：Alexis Lours「File:Common kingfisher on a branch facing right.jpg」CC BY 2.0；
   * 背景：Takashi Hososhima「File:Spring maple leaves (8689469096).jpg」CC BY-SA 2.0。 */
  src: '/assets/nature-atlas-hero-kingfisher-v5.webp',
  alt: '停在树枝上的普通翠鸟',
  note: '（合成）',
  credits: [
    { label: 'Alexis Lours / CC BY 2.0', href: 'https://commons.wikimedia.org/wiki/File:Common_kingfisher_on_a_branch_facing_right.jpg' },
    { label: 'Takashi Hososhima / CC BY-SA 2.0', href: 'https://commons.wikimedia.org/wiki/File:Spring_maple_leaves_(8689469096).jpg' },
  ],
}

/** 各图鉴头图与署名；署名显示在页面底部，不叠在照片上。 */
export const HERO_PHOTOS: Record<SpeciesAtlasTopicFilter, HeroPhoto> = {
  all: KINGFISHER,
  birds: KINGFISHER,
  insects: {
    /* AntanO「File:Papilio demoleus (Lime Butterfly) on leaf.JPG」CC BY-SA 3.0；已水平翻转并裁成 1800×1000。 */
    src: '/assets/nature-atlas-hero-insects.webp',
    alt: '停在嫩叶上的达摩凤蝶',
    note: '（已翻转裁切）',
    credits: [{ label: 'AntanO / CC BY-SA 3.0', href: 'https://commons.wikimedia.org/wiki/File:Papilio_demoleus_(Lime_Butterfly)_on_leaf.JPG' }],
  },
  plants: {
    /* Ashish2py「File:Match-stick-flower.jpg」CC BY-SA 4.0；已裁成 1800×1000。 */
    src: '/assets/nature-atlas-hero-plants.webp',
    alt: '绿叶虚化背景前的粉紫色花序',
    note: '（已裁切）',
    credits: [{ label: 'Ashish2py / CC BY-SA 4.0', href: 'https://commons.wikimedia.org/wiki/File:Match-stick-flower.jpg' }],
  },
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
      <Image src={HERO_PHOTOS[topic].src} alt={HERO_PHOTOS[topic].alt} fill priority sizes="100vw" className={styles.heroImage} />
      <div className={styles.heroShade} aria-hidden="true" />
      {children}
      <div className={styles.heroContent}>
        <p className={styles.kicker}><Leaf size={14} aria-hidden="true" />发现身边的自然</p>
        <h1>{heading}</h1>
        <dl className={styles.heroStats}>
          <div><dd>{stats.total}</dd><dt>{UNIT_SHORT[topic]}</dt></div>
          <div><dd>{stats.observed ?? '—'}</dd><dt>已观察</dt></div>
          <div><dd>{stats.unobserved ?? '—'}</dd><dt>待观察</dt></div>
        </dl>
      </div>
    </header>
  )
}
