import { describe, expect, it, vi } from 'vitest'

import {
  Alibaba1688Client,
  Alibaba1688Error,
  computeAlibaba1688Signature,
} from '@/lib/store/alibaba-1688'

describe('Alibaba1688Client', () => {
  it('computes a stable uppercase AOP HMAC-SHA1 signature', () => {
    expect(computeAlibaba1688Signature('/openapi/test', { z: 2, a: 'one', ignored: undefined }, 'secret'))
      .toBe('734C11E136B07CA1A1E41F81467AED93BA1FB7A1')
  })

  it('builds an OAuth URL with encoded state and redirect URI', () => {
    const client = new Alibaba1688Client({ appKey: 'app', appSecret: 'secret', redirectUri: 'https://example.com/callback' })
    const url = new URL(client.getAuthorizationUrl('state+/'))
    expect(url.hostname).toBe('auth.1688.com')
    expect(url.searchParams.get('client_id')).toBe('app')
    expect(url.searchParams.get('state')).toBe('state+/')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/callback')
  })

  it('rejects insecure API origins', () => {
    expect(() => new Alibaba1688Client({ origin: 'http://gw.example.com', appKey: 'a', appSecret: 'b', redirectUri: 'https://x' }))
      .toThrow(Alibaba1688Error)
  })

  it('maps aborts to a timeout error without exposing request parameters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      await new Promise<void>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
      throw new Error('unreachable')
    })
    try {
      const client = new Alibaba1688Client({ appKey: 'a', appSecret: 'b', redirectUri: 'https://x', timeoutMs: 1000 })
      await expect(client.execute('alibaba.test.echo', { secretParam: 'do-not-leak' }, 'token')).rejects.toMatchObject({ message: '1688 API request timed out' })
    } finally {
      fetchMock.mockRestore()
    }
  })
})
