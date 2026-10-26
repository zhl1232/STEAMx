import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { feishuHealth, getFeishuConfig } from './config'
const target = { id: 'store-team', chatId: 'oc_store', enabled: true, channels: ['store'], events: ['support.user_message', 'order.paid'] }
beforeEach(() => {
  vi.stubEnv('FEISHU_BRIDGE_ENABLED', 'true'); vi.stubEnv('FEISHU_APP_ID', 'cli_0123456789abcdef'); vi.stubEnv('FEISHU_APP_SECRET', 'test-secret')
  vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify([target])); vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([{ openId: 'ou_staff', profileId: '10000000-0000-4000-8000-000000000001' }]))
  vi.stubEnv('FEISHU_SITE_URL', ''); vi.stubEnv('FEISHU_TENANT_KEY', '')
})
afterEach(() => vi.unstubAllEnvs())
describe('Feishu bridge configuration', () => {
  it('keeps disabled configuration inert even when partial values exist', () => {
    vi.stubEnv('FEISHU_BRIDGE_ENABLED', 'false'); vi.stubEnv('FEISHU_TARGETS_JSON', 'invalid')
    expect(getFeishuConfig()).toBeNull(); expect(feishuHealth()).toMatchObject({ enabled: false, configured: false })
  })
  it('accepts independent targets and optional site links without exposing secrets in health', () => {
    expect(getFeishuConfig()?.targets[0]).toEqual(target)
    expect(getFeishuConfig()?.siteUrl).toBeUndefined()
    expect(feishuHealth()).toEqual({ enabled: true, configured: true, targets: 1, staff: 1 })
    expect(JSON.stringify(feishuHealth())).not.toContain('test-secret')
  })
  it('allows empty group and staff bindings for discovery without claiming readiness', () => {
    vi.stubEnv('FEISHU_TARGETS_JSON', '[]'); vi.stubEnv('FEISHU_STAFF_JSON', '[]')
    expect(getFeishuConfig()?.targets).toEqual([]); expect(feishuHealth().configured).toBe(false)
  })
  it('accepts an existing administrator UUID without RFC version or variant bits', () => {
    const person = { openId: 'ou_staff', profileId: '12345678-abcd-0000-0000-123456789abc' }
    vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([person]))
    expect(getFeishuConfig()?.staff).toEqual([person])
    expect(feishuHealth()).toEqual({ enabled: true, configured: true, targets: 1, staff: 1 })
  })
  it.each(['', 'not-a-uuid', '12345678abcd00000000123456789abc', '12345678-abcd-0000-0000-123456789abz', '12345678-abcd-0000-0000-123456789abc-extra', 42, null])('rejects malformed staff profile IDs: %j', profileId => {
    vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([{ openId: 'ou_staff', profileId }]))
    expect(() => getFeishuConfig()).toThrow('configuration_invalid')
  })
  it.each([
    [{ ...target, channels: ['community'] }],
    [{ ...target, events: ['other'] }],
    [target, target],
    [target, { ...target, id: 'other' }],
    [{ ...target, chatId: 'https://attacker.example' }],
    [{ ...target, enabled: 'true' }],
  ].map(value => ({ value })))('rejects invalid or duplicate target bindings without reflecting values: $value', ({ value }) => {
    vi.stubEnv('FEISHU_TARGETS_JSON', JSON.stringify(value))
    expect(() => getFeishuConfig()).toThrow('configuration_invalid'); expect(feishuHealth().configured).toBe(false)
  })
  it('rejects duplicate staff and unsafe site origins', () => {
    const person = { openId: 'ou_staff', profileId: '10000000-0000-4000-8000-000000000001' }
    vi.stubEnv('FEISHU_STAFF_JSON', JSON.stringify([person, person])); expect(() => getFeishuConfig()).toThrow('configuration_invalid')
    vi.stubEnv('FEISHU_STAFF_JSON', '[]'); vi.stubEnv('FEISHU_SITE_URL', 'https://user:secret@example.test/path'); expect(() => getFeishuConfig()).toThrow('configuration_invalid')
  })
})
