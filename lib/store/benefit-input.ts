import { z } from 'zod'
import { ValidationError } from '@/lib/api/validation'

const quoteSchema = z.object({
  originalSubtotalCents: z.number().int().nonnegative(), memberSubtotalCents: z.number().int().nonnegative(),
  memberDiscountCents: z.number().int().nonnegative(), membershipTier: z.enum(['free','pro','founder']),
  shippingCents: z.number().int().nonnegative(), couponDiscountCents: z.number().int().nonnegative(),
  coinDiscountCents: z.number().int().nonnegative(), coinsUsed: z.number().int().nonnegative(),
  totalCents: z.number().int().positive(), couponId: z.uuid().nullable(),
})
const benefits = z.object({couponId: z.uuid().nullish(), useCoins: z.boolean().optional(), expectedQuote: quoteSchema.optional()})
export function parseStoreBenefits(value: unknown) {
  const result = benefits.safeParse(value)
  if (!result.success) throw new ValidationError('结算优惠参数无效，请重新确认金额')
  if (result.data.couponId && result.data.useCoins) throw new ValidationError('优惠券和金币抵扣只能选择一种')
  return result.data
}
export const couponTemplateSchema = z.object({
  id: z.uuid().optional(), title: z.string().trim().min(1).max(180), thresholdCents: z.number().int().positive().max(100000000),
  discountCents: z.number().int().positive().max(100000000), validDays: z.number().int().min(1).max(366).nullish(),
  eligibleProductIds: z.array(z.uuid()).max(200).default([]),
  terms: z.string().trim().max(10000).nullish(), active: z.boolean(),
}).refine(v => v.discountCents < v.thresholdCents && (!v.active || (!!v.validDays && !!v.terms && v.eligibleProductIds.length > 0)), '请配置有效的门槛、金额、有效期及条款')
export const couponBatchSchema = z.object({templateId: z.uuid(), batchKey: z.string().trim().min(1).max(180), userIds: z.array(z.uuid()).min(1).max(500)})
