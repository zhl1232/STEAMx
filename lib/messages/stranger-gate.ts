/**
 * 私信递进门槛。关注是单向一键的，所以「对方关注了我」不能算认识；
 * 只有互相关注或对方已经回复，才逐级放开额度和内容限制。
 */

/** 陌生人（非互关且对方未回复）在对方回复前能发的条数 */
export const STRANGER_MESSAGE_LIMIT = 1

/** 互相关注但对方还没回复时能发的条数 */
export const MUTUAL_FOLLOW_MESSAGE_LIMIT = 3

export type MessageRelationship = 'stranger' | 'mutual_follow' | 'replied'

export type MessageGateDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403 | 429; error: string }

export function resolveMessageRelationship({
  hasReply,
  isMutualFollow,
}: {
  hasReply: boolean
  isMutualFollow: boolean
}): MessageRelationship {
  if (hasReply) return 'replied'
  return isMutualFollow ? 'mutual_follow' : 'stranger'
}

export function getMessageQuotaBeforeReply(relationship: MessageRelationship): number | null {
  switch (relationship) {
    case 'stranger':
      return STRANGER_MESSAGE_LIMIT
    case 'mutual_follow':
      return MUTUAL_FOLLOW_MESSAGE_LIMIT
    case 'replied':
      return null
  }
}

const EXTERNAL_LINK_PATTERN = /(?:https?:\/\/|www\.)\S+/iu
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u
const PHONE_PATTERN = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/u

export function containsContactInfo(content: string): boolean {
  return EXTERNAL_LINK_PATTERN.test(content) || EMAIL_PATTERN.test(content) || PHONE_PATTERN.test(content)
}

/**
 * 隐私档位 `followers_only` 采用互相关注语义：单向关注是一键的，
 * 只认互关才挡得住陌生人。已经回复过的会话直接放行——回复本身就是最强的同意信号，
 * 否则接收方切档位会把正在进行的对话单方面掐断。
 */
export function checkMessagePrivacyGate({
  privacy,
  relationship,
}: {
  privacy: string
  relationship: MessageRelationship
}): MessageGateDecision {
  if (privacy === 'nobody') {
    return { allowed: false, status: 403, error: '对方已关闭私信功能' }
  }

  if (privacy === 'followers_only' && relationship === 'stranger') {
    return { allowed: false, status: 403, error: '对方只接收互相关注的人的私信，先等对方回关吧' }
  }

  return { allowed: true }
}

export function checkStrangerMessageGate({
  relationship,
  sentBeforeReply,
  content,
}: {
  relationship: MessageRelationship
  sentBeforeReply: number
  content: string
}): MessageGateDecision {
  const quota = getMessageQuotaBeforeReply(relationship)

  if (quota !== null && sentBeforeReply >= quota) {
    return {
      allowed: false,
      status: 429,
      error:
        relationship === 'stranger'
          ? `对方还没有回复，第一次打招呼只能发 ${STRANGER_MESSAGE_LIMIT} 条。互相关注后可以再发 ${MUTUAL_FOLLOW_MESSAGE_LIMIT} 条。`
          : `对方还没有回复，最多先发 ${MUTUAL_FOLLOW_MESSAGE_LIMIT} 条，等一等吧。`,
    }
  }

  // 整个陌生人阶段都挡外链和联系方式，而不只是第一条
  if (relationship === 'stranger' && containsContactInfo(content)) {
    return {
      allowed: false,
      status: 400,
      error: '和还不认识的人打招呼时，不能带外链、邮箱或手机号',
    }
  }

  return { allowed: true }
}
