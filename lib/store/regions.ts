/** Mainland shipping region policy used by native checkout and admin forms. */
export const MAINLAND_PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省',
  '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省', '云南省',
  '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
] as const

export type MainlandProvince = (typeof MAINLAND_PROVINCES)[number]

export function normalizeMainlandProvince(value: string): MainlandProvince | null {
  const normalized = value.trim().replace(/(省|市|自治区)$/, (suffix) => suffix)
  return (MAINLAND_PROVINCES as readonly string[]).includes(normalized)
    ? normalized as MainlandProvince
    : null
}

export function normalizeBlockedProvinces(values: readonly string[] = []) {
  return [...new Set(values.map(normalizeMainlandProvince).filter((v): v is MainlandProvince => Boolean(v)))]
}

export function isProvinceBlocked(province: string, blocked: readonly string[]) {
  const normalized = normalizeMainlandProvince(province)
  return normalized !== null && normalizeBlockedProvinces(blocked).includes(normalized)
}
