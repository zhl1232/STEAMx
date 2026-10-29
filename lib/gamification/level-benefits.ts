import { SHOP_ITEMS } from '@/lib/shop/items'

export type BenefitType = 'vanity' | 'feature' | 'power' | 'wealth'
export type LevelBenefit = { text: string; type: BenefitType; highlight?: boolean; itemId?: string }
export type LevelBenefitTier = { level: number; xp: number; benefits: LevelBenefit[] }

// 装扮门槛沿用商品配置；等级解锁兑换资格，不直接赠送商品。
const additionalBenefits: Record<number, LevelBenefit[]> = {
  5: [{ text: '达到审核员申请的等级条件；仍需综合评分达标、通过违规检查与申请审核', type: 'power' }],
  20: [{ text: '已通过审核的项目在项目推荐排序中获得等级加权，不保证曝光或排名', type: 'power' }],
  30: [{ text: '项目推荐排序的等级加权提升', type: 'power' }],
  50: [
    { text: '可在外观设置中启用黑金传说主题', type: 'vanity', highlight: true },
    { text: '项目推荐排序的等级加权达到当前最高档', type: 'power' },
  ],
}

const levels = [...new Set([
  ...SHOP_ITEMS.map(item => Math.max(1, item.minLevel ?? 1)),
  ...Object.keys(additionalBenefits).map(Number),
])].sort((a, b) => a - b)

export const LEVEL_BENEFITS: LevelBenefitTier[] = levels.map(level => ({
  level,
  xp: 100 * (level - 1) ** 2,
  benefits: [
    ...SHOP_ITEMS.filter(item => Math.max(1, item.minLevel ?? 1) === level).map(item => ({
      itemId: item.id,
      text: `可用硬币兑换「${item.name}」${item.type === 'avatar_frame' ? '头像框' : '昵称颜色'}`,
      type: 'wealth' as const,
    })),
    ...(additionalBenefits[level] ?? []),
  ],
}))
