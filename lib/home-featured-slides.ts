export interface HomeFeaturedSlide {
  id: string
  eyebrow: string
  title: string
  description: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
  theme: 'nature'
}

export const homeFeaturedSlides: HomeFeaturedSlide[] = [
  {
    id: 'natural-observation',
    eyebrow: '自然观察频道',
    title: '北京春季观鸟',
    description: '从校园和公园开始，记下你的第一条观察。',
    primaryLabel: '开始第一次观察',
    primaryHref: '/bird-observation',
    secondaryLabel: '查看常见鸟种',
    secondaryHref: '/explore/species',
    theme: 'nature',
  },
]
