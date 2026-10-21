/** 观察审核通过后的站内通知文案：按物种大类推荐下一次去找什么。 */
const TOPIC_NOUN: Record<string, string> = {
  birds: '鸟',
  bird: '鸟',
  insects: '昆虫',
  insect: '昆虫',
  plants: '植物',
  plant: '植物',
  trees: '树',
  tree: '树',
}

export function getNextFindNoun(topic: string | null | undefined): string {
  return (topic && TOPIC_NOUN[topic]) || '自然生物'
}

export function buildObservationApprovedNotice(args: {
  speciesName?: string | null
  topic?: string | null
  xpAwarded?: number | null
}) {
  const name = args.speciesName?.trim()
  const xp = args.xpAwarded && args.xpAwarded > 0 ? `，+${args.xpAwarded} 经验` : ''
  const lit = name ? `图鉴已点亮「${name}」` : '已计入你的图鉴'
  return {
    title: '观察审核通过',
    content: `你的观察审核通过了${xp}，${lit}。再找一种${getNextFindNoun(args.topic)}试试？`,
  }
}
