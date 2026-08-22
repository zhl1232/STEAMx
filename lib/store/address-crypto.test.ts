import { describe, expect, it } from 'vitest'

import { decryptStoreAddress, encryptStoreAddress, maskRecipientName, phoneLast4 } from '@/lib/store/address-crypto'

const payload = {
  recipientName: '小明妈妈',
  phone: '13812345678',
  province: '浙江省',
  city: '杭州市',
  district: '西湖区',
  street: '未来街道 1 号',
  postalCode: '310000',
}

describe('store address crypto', () => {
  it('round-trips with AES-GCM and rejects tampering', () => {
    const previous = process.env.STORE_ADDRESS_ENCRYPTION_KEY
    process.env.STORE_ADDRESS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    try {
      const encrypted = encryptStoreAddress(payload)
      expect(decryptStoreAddress(encrypted)).toEqual(payload)
      const parts = encrypted.split('.')
      const last = parts[3].slice(-1)
      parts[3] = `${parts[3].slice(0, -1)}${last === 'A' ? 'B' : 'A'}`
      expect(() => decryptStoreAddress(parts.join('.'))).toThrow()
    } finally {
      if (previous === undefined) delete process.env.STORE_ADDRESS_ENCRYPTION_KEY
      else process.env.STORE_ADDRESS_ENCRYPTION_KEY = previous
    }
  })

  it('masks identity fields for order listings', () => {
    expect(maskRecipientName('小明妈妈')).toBe('小***')
    expect(phoneLast4('138-1234-5678')).toBe('5678')
  })
})
