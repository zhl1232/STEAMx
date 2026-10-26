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
        return amount < 0 ? `打赏给 ${counterpartyDisplayText}` : `收到 ${counterpartyDisplayText} 的打赏`
      }
      return resourceId ? `打赏 ${resourceId}` : '打赏'
    case 'challenge_prize':
      return counterpartyDisplayText || '挑战奖励'
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
