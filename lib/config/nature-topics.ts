export type NatureTopicStatus = 'available' | 'upcoming'

export const natureTopicKeys = ['birds', 'insects', 'plants', 'fungi'] as const
export type NatureTopicKey = (typeof natureTopicKeys)[number]

export const natureTopicLabels: Record<NatureTopicKey, string> = {
  birds: '鸟类',
  insects: '昆虫',
  plants: '植物',
  fungi: '真菌',
}

export interface NatureTopicConfig {
  id: NatureTopicKey
  slug: NatureTopicKey
  title: string
  subtitle: string
  description: string
  status: NatureTopicStatus
  href?: string
}

export const natureTopics: NatureTopicConfig[] = [
  {
    id: 'birds',
    slug: 'birds',
    title: '鸟类观察',
    subtitle: '已上线专题',
    description: '从校园、公园和社区出发，记录常见鸟类的出现时间、地点与行为。',
    status: 'available',
    href: '/nature/species?topic=birds',
  },
  {
    id: 'insects',
    slug: 'insects',
    title: '昆虫观察',
    subtitle: '已上线专题',
    description: '围绕常见昆虫建立观察清单，覆盖季节变化与栖息环境。',
    status: 'available',
    href: '/nature/species?topic=insects',
  },
  {
    id: 'plants',
    slug: 'plants',
    title: '植物观察',
    subtitle: '已上线专题',
    description: '覆盖树木、花草和食用植物，记录叶片、花果、种子与生长环境等线索。',
    status: 'available',
    href: '/nature/species?topic=plants',
  },
  {
    id: 'fungi',
    slug: 'fungi',
    title: '真菌观察',
    subtitle: '专题预告',
    description: '记录雨后和潮湿环境中的真菌线索，逐步补全本地真菌档案。',
    status: 'upcoming',
  },
]
