import type { StoreAddressPayload } from '@/lib/store/address-crypto'
import type { StoreCheckoutItemInput } from '@/lib/store/service'

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function parseStoreItems(value: unknown): StoreCheckoutItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error('商品清单不能为空')
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('商品清单格式错误')
    const candidate = item as { variantId?: unknown; quantity?: unknown }
    if (!isUuid(candidate.variantId)) throw new Error('商品规格无效')
    const quantity = Number(candidate.quantity)
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
      throw new Error('购买数量必须是 1 到 100 的整数')
    }
    return { variantId: candidate.variantId, quantity }
  })
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== 'string') throw new Error(`${label}格式错误`)
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) throw new Error(`${label}格式错误`)
  return normalized
}

export function parseStoreAddress(value: unknown): StoreAddressPayload {
  if (!value || typeof value !== 'object') throw new Error('收货地址格式错误')
  const address = value as Record<string, unknown>
  const phone = requiredText(address.phone, '手机号', 32).replace(/[\s-]/g, '')
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('手机号格式错误')
  const postalCode = address.postalCode == null || address.postalCode === ''
    ? undefined
    : requiredText(address.postalCode, '邮编', 12)
  return {
    recipientName: requiredText(address.recipientName, '收货人', 40),
    phone,
    province: requiredText(address.province, '省份', 80),
    city: requiredText(address.city, '城市', 80),
    district: requiredText(address.district, '区县', 80),
    street: requiredText(address.street, '详细地址', 240),
    postalCode,
  }
}
