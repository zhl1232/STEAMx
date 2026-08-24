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
    title: '记录身边的自然',
    description: '从校园和公园开始，记下你的第一条观察。',
    primaryLabel: '开始第一次观察',
    primaryHref: '/nature/birds',
    secondaryLabel: '查看常见鸟种',
    secondaryHref: '/nature/species',
    theme: 'nature',
  },
  {
    id: 'create-camp',
    eyebrow: '创造营',
    title: '动手做项目',
    description: '在创造营里接项目挑战、学技能课程，把想法变成作品。',
    primaryLabel: '进入创造营',
    primaryHref: '/create',
    secondaryLabel: '浏览观察记录',
    secondaryHref: '/nature/observations',
    theme: 'nature',
  },
]
