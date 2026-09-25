/**
 * 将用户输入的手机号规范为 E.164 格式（如 +8613800138000），
 * 供 Supabase auth（signInWithOtp / updateUser / verifyOtp）使用。
 */
export function toE164(input: string, defaultRegion = '86'): string {
  const digits = input.replace(/\D/g, '')
  if (!digits.length) return ''
  // 已带国家码且以 86 开头（中国大陆）
  if (digits.startsWith('86') && digits.length >= 11) {
    return `+${digits}`
  }
  return `+${defaultRegion}${digits}`
}

/**
 * 把 E.164（带或不带 '+'，如 Supabase Auth 发来的 8613800138000）或 11 位号码
 * 规范为中国大陆 11 位手机号；非大陆手机号返回 null。
 * requireCountryCode=true 时只接受带 86 国家码的输入。
 */
export function toMainlandMobile(input: string, options: { requireCountryCode?: boolean } = {}): string | null {
  const digits = String(input ?? '').replace(/\D/g, '')
  // Supabase Auth 总是给出完整 E.164 数字；要求带 86 可避免把 1 开头的北美号码（如 14155552671）误当大陆号。
  if (options.requireCountryCode && !(digits.length === 13 && digits.startsWith('86'))) return null
  const local = digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits
  return /^1[3-9]\d{9}$/.test(local) ? local : null
}

/** 日志用手机号脱敏：保留前 3 位与后 4 位，如 138****8000。 */
export function maskPhone(input: string | null | undefined): string {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length < 7) return digits ? '***' : '(empty)'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}
