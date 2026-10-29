import { getShopItemById } from '@/lib/shop/items'

export function getActionLabel(
  actionType: string,
  resourceId: string | null,
  counterpartyDisplayText: string | null,
  amount: number,
): string {
  switch (actionType) {
    case 'daily_login':
      return '每日签到'
    case 'purchase': {
      const item = resourceId ? getShopItemById(resourceId) : null
      return item ? `兑换「${item.name}」` : '兑换商品'
    }
    case 'tip':
      if (counterpartyDisplayText) {
        return amount < 0 ? `投币给 ${counterpartyDisplayText}` : `收到 ${counterpartyDisplayText} 的投币`
      }
      return resourceId ? `投币 ${resourceId}` : '投币支持'
    case 'challenge_prize':
      return counterpartyDisplayText || '挑战奖励'
    case 'playground_entry':
      return '挑战报名'
    case 'playground_prize':
      return '挑战奖励'
    case 'playground_refund':
      return '挑战退款'
    case 'coupon_exchange':
      return '兑换材料优惠券'
    case 'store_redeem':
      return '实物订单硬币抵扣'
    case 'store_release':
      return '订单抵扣硬币返还'
    case 'balance_baseline':
      return '历史结余'
    default:
      return actionType || '其他'
  }
}
