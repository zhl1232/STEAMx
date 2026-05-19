export function getMaterialMeta(material: string) {
  const normalized = material.trim()
  const amountMatch = normalized.match(
    /(?:[x×*]\s*)?(\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克))/i,
  )
  const amount = amountMatch?.[1] ?? (/水|胶|颜料|纸|线/.test(normalized) ? '适量' : '1 个')
  const rawName = normalized
    .replace(
      /(?:[x×*]\s*)?\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克)/gi,
      '',
    )
    .replace(/[，,、:：-]+$/g, '')
    .trim()
  const noteMatch = rawName.match(/^(.*?)[（(]([^）)]+)[）)]$/)
  const name = noteMatch?.[1]?.trim() || rawName
  const note = noteMatch?.[2]?.trim()

  return {
    name: name || normalized,
    amount,
    note,
  }
}
