import {
  natureTopicKeys,
  natureTopicLabels,
  type NatureTopicKey,
} from '@/lib/config/nature-topics'

export type SpeciesTopicFilter = NatureTopicKey | 'all'

const visibleSpeciesTopicKeys = ['birds', 'plants'] as const
type VisibleSpeciesTopicKey = (typeof visibleSpeciesTopicKeys)[number]

export interface SpeciesTopicSource {
  nature_topic?: string | null
  natureTopic?: string | null
  common_name?: string | null
  commonName?: string | null
  scientific_name?: string | null
  scientificName?: string | null
  taxon_group?: string | null
  taxonGroup?: string | null
}

export interface SpeciesTopicCount {
  key: SpeciesTopicFilter
  label: string
  count: number
}

const birdKeywords = [
  '鸟',
  '禽',
  '鹭',
  '鸭',
  '雁',
  '鹅',
  '鹳',
  '鹤',
  '鸥',
  '鸻',
  '鹬',
  '鸠',
  '鸽',
  '鹃',
  '鸮',
  '隼',
  '鹰',
  '鹗',
  '雕',
  '鹫',
  '鹞',
  '鸢',
  '鸨',
  '雉',
  '鹌',
  '鹑',
  '鸬鹚',
  '䴙',
  '秧鸡',
  '水鸡',
  '骨顶',
  '翠鸟',
  '啄木',
  '百灵',
  '燕',
  '鹨',
  '鹡鸰',
  '鹎',
  '伯劳',
  '鸦',
  '椋鸟',
  '雀',
  '莺',
  '鸫',
  '鸲',
  '鹟',
  '鹀',
  '山雀',
  '戴菊',
  '鹪鹩',
]

const insectKeywords = [
  '昆虫',
  '虫',
  '蝶',
  '蛾',
  '蜂',
  '蚁',
  '甲虫',
  '瓢虫',
  '蜻蜓',
  '螳螂',
  '蟋蟀',
  '蝉',
  '蝽',
  '蚊',
  '蝇',
  '螽斯',
  '蝗',
  '蚱',
]

const plantKeywords = [
  '植物',
  '花',
  '草',
  '树',
  '灌木',
  '乔木',
  '藤',
  '莲',
  '荷',
  '兰',
  '菊',
  '蔷薇',
  '松',
  '柏',
  '蕨',
  '苔藓',
  '藻',
]

const fungiKeywords = ['真菌', '菌物', '蘑菇', '菇', '木耳', '灵芝', '马勃', '伞菌']

function matchAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

export function isNatureTopicKey(value: string | null | undefined): value is NatureTopicKey {
  return natureTopicKeys.includes(value as NatureTopicKey)
}

export function isVisibleSpeciesTopicKey(value: string | null | undefined): value is VisibleSpeciesTopicKey {
  return visibleSpeciesTopicKeys.includes(value as VisibleSpeciesTopicKey)
}

export function normalizeSpeciesTopicFilter(value: string | null | undefined): SpeciesTopicFilter {
  if (value === 'all' || value == null || value === '') return 'all'
  return isVisibleSpeciesTopicKey(value) ? value : 'all'
}

export function getNatureTopicLabel(topicKey: NatureTopicKey | null | undefined) {
  return topicKey ? natureTopicLabels[topicKey] : '未分类'
}

export function resolveSpeciesNatureTopicKey(row: SpeciesTopicSource): NatureTopicKey | null {
  const explicitTopic = row.nature_topic ?? row.natureTopic
  if (isNatureTopicKey(explicitTopic)) {
    return explicitTopic
  }

  const commonName = row.common_name ?? row.commonName ?? ''
  const scientificName = row.scientific_name ?? row.scientificName ?? ''
  const taxonGroup = row.taxon_group ?? row.taxonGroup ?? ''
  const text = `${commonName} ${scientificName} ${taxonGroup}`

  if (matchAnyKeyword(text, birdKeywords)) return 'birds'
  if (matchAnyKeyword(text, fungiKeywords)) return 'fungi'
  if (matchAnyKeyword(text, insectKeywords)) return 'insects'
  if (matchAnyKeyword(text, plantKeywords)) return 'plants'

  return null
}

export function buildSpeciesTopicCounts(rows: Array<{ topicKey?: NatureTopicKey | null }>): SpeciesTopicCount[] {
  const visibleRows = rows.filter((row) => row.topicKey && isVisibleSpeciesTopicKey(row.topicKey))

  return [
    { key: 'all', label: '全部', count: visibleRows.length },
    ...visibleSpeciesTopicKeys.map((key) => ({
      key,
      label: natureTopicLabels[key],
      count: rows.filter((row) => row.topicKey === key).length,
    })),
  ]
}
