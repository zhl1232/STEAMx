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
