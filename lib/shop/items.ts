/**
 * 商店商品配置（MVP 配置驱动）
 * 头像框等商品 id、名称、价格与前端样式 key
 */

export type ShopItemType = 'avatar_frame'

export interface ShopItem {
  id: string
  name: string
  price: number
  type: ShopItemType
  /** 前端边框样式 key，用于 CSS 或 AvatarWithFrame */
  styleKey: string
}

export const AVATAR_FRAME_ITEMS: ShopItem[] = [
  { id: 'neon_halo', name: '霓虹光环', price: 10, type: 'avatar_frame', styleKey: 'neon_halo' },
  { id: 'pixel_border', name: '像素边框', price: 8, type: 'avatar_frame', styleKey: 'pixel_border' },
]

export const SHOP_ITEMS: ShopItem[] = [...AVATAR_FRAME_ITEMS]

export function getShopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id)
}

export function getAvatarFrameStyleKey(itemId: string | null): string | null {
  if (!itemId) return null
  const item = getShopItemById(itemId)
  return item?.type === 'avatar_frame' ? item.styleKey : null
}

/** 返回头像框对应的 Tailwind/CSS 类名，用于 AvatarWithFrame */
export function getAvatarFrameClassName(itemId: string | null): string {
  const key = getAvatarFrameStyleKey(itemId)
  if (!key) return ''
  switch (key) {
    case 'neon_halo':
      return 'avatar-frame-neon-halo'
    case 'pixel_border':
      return 'avatar-frame-pixel-border'
    default:
      return ''
  }
}
