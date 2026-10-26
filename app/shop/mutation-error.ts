export type ShopMutationError = Error & {
  code?: string
  minLevel?: number
  currentLevel?: number
}

export function getShopMutationErrorMessage(error: unknown): string {
  const shopError = error as ShopMutationError | null
  const code = shopError?.code || shopError?.message

  switch (code) {
    case 'price_changed':
    case 'quote_required':
      return '会员价格已变化，已刷新价格，请确认后重新兑换'
    case 'insufficient_coins':
      return '硬币不足'
    case 'invalid_item':
      return '商品无效'
    case 'already_owned':
      return '已拥有该商品，无需重复兑换'
    case 'unauthorized':
      return '登录状态已失效，请重新登录后再试'
    case 'profile_not_found':
      return '未找到当前账号资料，请稍后重试'
    case 'min_level_required':
      return typeof shopError?.minLevel === 'number' ? `等级不足，需达到 Lv.${shopError.minLevel}` : '当前等级不足，暂时无法兑换'
    case 'not_owned':
      return '未拥有该商品，无法装备'
    case 'not_name_color':
      return '该商品不是昵称颜色，无法装备'
    case 'equip_failed':
      return '装备失败，请稍后重试'
    case 'purchase_failed':
      return '兑换失败，请稍后重试'
    default:
      return error instanceof Error && error.message ? error.message : '请稍后重试'
  }
}
