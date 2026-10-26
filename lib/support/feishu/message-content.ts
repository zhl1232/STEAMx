import { FeishuBridgeError, feishuId } from './config'

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export function validImageKey(value: unknown): value is string {
  return typeof value === 'string' && /^img_[A-Za-z0-9_-]{1,240}$/.test(value)
}

/** Parse only the supported receive-message schemas; never omit unsupported media. */
export function parseFeishuContent(messageType: string, contentString: string, mentions: unknown, botOpenId: string): { text: string; imageKeys: string[]; mentionedBot: boolean } {
  const invalid = (): never => { throw new FeishuBridgeError('event_invalid', 400) }
  if (typeof contentString !== 'string' || contentString.length > 30000 || !feishuId(botOpenId, 'ou_')) return invalid()
  const mentionList = mentions === undefined ? [] : mentions
  if (!Array.isArray(mentionList) || mentionList.length > 50) return invalid()
  const mentionMap = new Map<string, { openId: string; name: string }>()
  for (const mention of mentionList) {
    if (!object(mention) || typeof mention.key !== 'string' || !/^@[A-Za-z0-9_-]{1,99}$/.test(mention.key) || !object(mention.id) || !feishuId(mention.id.open_id, 'ou_') || (mention.name !== undefined && (typeof mention.name !== 'string' || mention.name.length > 200)) || mentionMap.has(mention.key)) return invalid()
    mentionMap.set(mention.key, { openId: mention.id.open_id, name: typeof mention.name === 'string' ? mention.name : mention.id.open_id })
  }
  let content: unknown
  try { content = JSON.parse(contentString) } catch { return invalid() }
  if (!object(content)) return invalid()
  let mentionedBot = false
  const imageKeys: string[] = []
  const image = (key: unknown) => {
    if (!validImageKey(key)) return invalid()
    if (imageKeys.includes(key)) return invalid()
    imageKeys.push(key)
    if (imageKeys.length > 3) return invalid()
  }
  const plainText = (value: string): string => value.replace(/@[A-Za-z0-9_-]+/g, key => {
    const mention = mentionMap.get(key)
    if (!mention) return key
    if (mention.openId === botOpenId) { mentionedBot = true; return '' }
    return `@${mention.name}`
  })
  let text = ''
  if (messageType === 'text') {
    if (typeof content.text !== 'string') return invalid()
    text = plainText(content.text)
  } else if (messageType === 'image') {
    image(content.image_key)
  } else if (messageType === 'post') {
    const post = 'content' in content ? content : content.zh_cn
    if (!object(post) || !Array.isArray(post.content) || post.content.length > 2000 || (post.title !== undefined && typeof post.title !== 'string')) return invalid()
    const lines: string[] = []
    if (post.title) lines.push(plainText(post.title as string))
    for (const line of post.content) {
      if (!Array.isArray(line) || line.length > 2000) return invalid()
      let lineText = ''
      for (const node of line) {
        if (!object(node)) return invalid()
        if (node.tag === 'text' || node.tag === 'a') {
          if (typeof node.text !== 'string') return invalid()
          lineText += plainText(node.text)
        } else if (node.tag === 'img') image(node.image_key)
        else if (node.tag === 'at') {
          if (typeof node.user_id !== 'string') return invalid()
          const mention = mentionMap.get(node.user_id) ?? [...mentionMap.values()].find(item => item.openId === node.user_id)
          if (!mention) return invalid()
          const openId = mention.openId
          if (openId === botOpenId) mentionedBot = true
          else {
            const name = mention?.name ?? (typeof node.user_name === 'string' && node.user_name.length <= 200 ? node.user_name : openId)
            lineText += `@${name}`
          }
        } else return invalid()
      }
      lines.push(lineText)
    }
    text = lines.join('\n')
  } else return invalid()
  text = text.trim()
  if (text.length > 2000 || (!text && !imageKeys.length)) return invalid()
  return { text, imageKeys, mentionedBot }
}
