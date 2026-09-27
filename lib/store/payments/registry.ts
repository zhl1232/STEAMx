import { createAlipayAdapter } from './alipay'
import { createWechatAdapter } from './wechat'
import type { PaymentAdapter, PaymentProvider } from './types'
import { StoreServiceError } from '../service'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value)
    throw new StoreServiceError(
      '支付通道尚未完成配置',
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
      503,
    )
  return value.replace(/\\n/g, '\n')
}

export function paymentOrigin(): string {
  const url = new URL(required('STORE_PAYMENT_ORIGIN'))
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new StoreServiceError(
      '支付回调地址配置无效',
      'PAYMENT_ORIGIN_INVALID',
      503,
    )
  }
  return url.origin
}

/** Disabling new checkout must not disable callbacks/reconciliation for prior payments. */
export function configuredPaymentAdapter(
  provider: PaymentProvider,
): PaymentAdapter {
  const environment =
    process.env.STORE_ENVIRONMENT === 'test' ? 'test' : 'production'
  const notifyUrl = `${paymentOrigin()}/api/store/payments/${provider}/notify`
  if (provider === 'alipay')
    return createAlipayAdapter({
      appId: required('ALIPAY_APP_ID'),
      merchantId: required('ALIPAY_SELLER_ID'),
      privateKey: required('ALIPAY_PRIVATE_KEY'),
      alipayPublicKey: required('ALIPAY_PUBLIC_KEY'),
      environment,
      notifyUrl,
    })
  return createWechatAdapter({
    appid: required('WECHAT_PAY_APP_ID'),
    mchid: required('WECHAT_PAY_MCH_ID'),
    merchantSerial: required('WECHAT_PAY_MERCHANT_SERIAL'),
    merchantPrivateKey: required('WECHAT_PAY_PRIVATE_KEY'),
    apiV3Key: required('WECHAT_PAY_API_V3_KEY'),
    platformPublicKeys: {
      [required('WECHAT_PAY_PUBLIC_KEY_ID')]: required('WECHAT_PAY_PUBLIC_KEY'),
    },
    environment,
    notifyUrl,
  })
}
