const AMOUNT_RE = /(?:[x×*]\s*)?(\d+(?:\.\d+)?(?:\s*[-–至]\s*\d+(?:\.\d+)?)?\s*(?:个|只|张|根|支|套|瓶|块|枚|片|条|卷|米|cm|厘米|ml|毫升|g|克))/i
const SIMPLE_CHINESE_AMOUNT_RE = /^(一个|一只|一张|一根|一支|一套|一瓶|一块|一枚|一片|一条|一卷)(?=\S)/

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
  // A row can contain both a specification and a count, or multiple materials.
  // Keep it intact rather than dropping quantities we cannot safely separate.
  if (Array.from(baseRaw.matchAll(new RegExp(AMOUNT_RE.source, 'gi'))).length > 1) {
    return { name: baseRaw, amount: '', note }
  }
  const chineseAmountMatch = baseRaw.match(SIMPLE_CHINESE_AMOUNT_RE)
  const amount = amountMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? chineseAmountMatch?.[1] ?? ''
  const name = baseRaw
    .replace(AMOUNT_RE, '')
    .replace(SIMPLE_CHINESE_AMOUNT_RE, '')
    .replace(/[，,、:：-]+$/g, '')
    .trim()

  return {
    name: name || normalized,
    amount,
    note,
  }
}
