import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateOptionalString, validateUUID, ValidationError } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  STORE_CHECKOUT_MODES,
  STORE_EXTERNAL_CHANNELS,
  isSupportedExternalChannel,
  isStoreContextKey,
  normalizeTaobaoUrl,
  normalizeStoreContextKeys,
} from '@/lib/store/external-channel'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    await requireRole(supabase, ['admin'])
    if (!supabaseAdmin) {
      throw new Error('商城服务尚未配置数据库管理员密钥')
    }

    const { id } = await params
    const productId = validateUUID(id, 'Product id')
    const body = await request.json()
    const checkoutMode = validateEnum(body.checkout_mode, 'checkout_mode', STORE_CHECKOUT_MODES)
    const rawContextKeys = body.context_keys
    if (!Array.isArray(rawContextKeys) && typeof rawContextKeys !== 'string' && rawContextKeys !== undefined) {
      throw new ValidationError('context_keys must be an array or comma-separated string')
    }
    const contextKeys = normalizeStoreContextKeys(rawContextKeys)
    const rawContextValues = Array.isArray(rawContextKeys)
      ? rawContextKeys
      : typeof rawContextKeys === 'string'
        ? rawContextKeys.split(/[\s,，、]+/).filter(Boolean)
        : []
    if (rawContextValues.length > 24) throw new ValidationError('context_keys 最多配置 24 个')
    if (rawContextValues.some((value) => !isStoreContextKey(typeof value === 'string' ? value.trim() : value))) {
      throw new ValidationError('context_keys 只能使用 course:ID、lesson:ID 或 project:ID 格式')
    }

    let externalChannel: string | null = null
    let externalUrl: string | null = null

    if (checkoutMode === 'external') {
      const channel = validateOptionalString(body.external_channel, 'external_channel', 40)
      if (!channel || !isSupportedExternalChannel(channel)) {
        throw new ValidationError(`external_channel must be one of: ${STORE_EXTERNAL_CHANNELS.join(', ')}`)
      }

      const rawUrl = validateOptionalString(body.external_url, 'external_url', 2048)
      if (!rawUrl) throw new ValidationError('淘宝商品链接不能为空')
      const safeUrl = normalizeTaobaoUrl(rawUrl)
      if (!safeUrl) {
        throw new ValidationError('淘宝商品链接必须是淘宝/天猫的 HTTPS 链接')
      }

      externalChannel = channel
      externalUrl = safeUrl
    }

    const { data, error } = await supabaseAdmin
      .from('store_products')
      .update({
        checkout_mode: checkoutMode,
        external_channel: externalChannel,
        external_url: externalUrl,
        context_keys: contextKeys,
      })
      .eq('id', productId)
      .select('id, name, checkout_mode, external_channel, external_url, context_keys, updated_at')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: '商品不存在' }, { status: 404 })

    return NextResponse.json({ product: data })
  } catch (error) {
    return handleApiError(error)
  }
}
