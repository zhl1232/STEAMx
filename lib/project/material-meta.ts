const AMOUNT_RE =
  /(?:[x×*]\s*)?(\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克))/i

export type MaterialMeta = {
  name: string
  amount: string
  note?: string
}

export function getMaterialMeta(material: string): MaterialMeta {
  const normalized = material.trim()
  const noteMatch = normalized.match(/^(.*?)[（(]([^）)]+)[）)]$/)
  const baseRaw = noteMatch?.[1]?.trim() || normalized
  const note = noteMatch?.[2]?.trim()

  // 自备（清单）：括号内的「1个」不是整行数量，清单要留在展示文案里。
  if (baseRaw === '自备' && note) {
    return {
      name: `自备：${note}`,
      amount: '',
      note,
    }
  }

  const amountMatch = baseRaw.match(AMOUNT_RE)
  const amount = amountMatch?.[1] ?? (/水|胶|颜料|纸|线/.test(normalized) ? '适量' : '1 个')
  const name = baseRaw
    .replace(
      /(?:[x×*]\s*)?\d+(?:\.\d+)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克)/gi,
      '',
    )
    .replace(/[，,、:：-]+$/g, '')
    .trim()

  return {
    name: name || normalized,
    amount,
    note,
  }
}
