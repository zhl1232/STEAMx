/**
 * 商店商品配置（MVP 配置驱动）
 * 头像框等商品 id、名称、价格与前端样式 key
 */

export type ShopItemType = 'avatar_frame' | 'name_color'

export interface ShopItem {
  id: string
  name: string
  price: number
  type: ShopItemType
  /** 前端边框样式 key，用于 CSS 或 AvatarWithFrame */
  styleKey: string
  /** 兑换所需最低等级，0 或 undefined 表示无门槛 */
  minLevel?: number
}

export const AVATAR_FRAME_ITEMS: ShopItem[] = [
  { id: 'pixel_border', name: '像素边框', price: 15, type: 'avatar_frame', styleKey: 'pixel_border' },
  { id: 'crystal_glass', name: '深海琉璃', price: 50, type: 'avatar_frame', styleKey: 'crystal_glass', minLevel: 5 },
  { id: 'neon_halo', name: '霓虹光环', price: 150, type: 'avatar_frame', styleKey: 'neon_halo', minLevel: 10 },
  { id: 'cyber_glitch', name: '赛博故障', price: 300, type: 'avatar_frame', styleKey: 'cyber_glitch', minLevel: 20 },
  { id: 'golden_crown', name: '黄金王冠', price: 800, type: 'avatar_frame', styleKey: 'golden_crown', minLevel: 30 },
]

export const NAME_COLOR_ITEMS: ShopItem[] = [
  { id: 'name_color_cherry', name: '樱花粉波', price: 15, type: 'name_color', styleKey: 'name_color_cherry' },
  { id: 'name_color_abyss', name: '深渊幽蓝', price: 50, type: 'name_color', styleKey: 'name_color_abyss', minLevel: 5 },
  { id: 'name_color_neon', name: '赛博霓虹', price: 150, type: 'name_color', styleKey: 'name_color_neon', minLevel: 10 },
  { id: 'name_color_gold', name: '真命暗金', price: 500, type: 'name_color', styleKey: 'name_color_gold', minLevel: 20 },
]

export const SHOP_ITEMS: ShopItem[] = [...AVATAR_FRAME_ITEMS, ...NAME_COLOR_ITEMS]

export function getShopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id)
}

export function getAvatarFrameStyleKey(itemId: string | null): string | null {
  if (!itemId) return null
  const item = getShopItemById(itemId)
  return item?.type === 'avatar_frame' ? item.styleKey : null
}

export function getNameColorStyleKey(itemId: string | null): string | null {
  if (!itemId) return null
  const item = getShopItemById(itemId)
  return item?.type === 'name_color' ? item.styleKey : null
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
    case 'golden_crown':
      return 'avatar-frame-golden-crown'
    case 'cyber_glitch':
      return 'avatar-frame-cyber-glitch'
    case 'crystal_glass':
      return 'avatar-frame-crystal-glass'
    default:
      return ''
  }
}

/** 返回名字颜色对应的 Tailwind/CSS 类名，用于名字展示处 */
export function getNameColorClassName(itemId: string | null): string {
  const key = getNameColorStyleKey(itemId)
  if (!key) return ''
  switch (key) {
    case 'name_color_neon':
      return 'name-color-neon'
    case 'name_color_cherry':
      return 'name-color-cherry'
    case 'name_color_abyss':
      return 'name-color-abyss'
    case 'name_color_gold':
      return 'name-color-gold'
    default:
      return ''
  }
}
