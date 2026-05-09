export const EXPERIENCE_RULES = [
  {
    id: 'publish_project',
    action: '发布项目',
    reward: '+50',
    description: '分享你的创意作品',
  },
  {
    id: 'complete_project',
    action: '完成项目',
    reward: '+20',
    description: '作品审核通过后获得经验',
  },
  {
    id: 'submit_observation',
    action: '提交自然观察',
    reward: '+10',
    description: '发布一条自然观察记录',
  },
  {
    id: 'join_challenge',
    action: '参加挑战',
    reward: '+10',
    description: '报名参与主题挑战',
  },
  {
    id: 'complete_challenge',
    action: '完成挑战',
    reward: '+20',
    description: '挑战作品通过审核后获得经验',
  },
  {
    id: 'create_discussion',
    action: '发起讨论',
    reward: '+5',
    description: '在社区分享观点',
  },
  {
    id: 'reply_or_comment',
    action: '评论或回复',
    reward: '+1',
    description: '参与互动交流，评论与回复分别每日上限 50 经验',
  },
  {
    id: 'like_project',
    action: '点赞项目',
    reward: '+1',
    description: '鼓励优秀作品',
  },
  {
    id: 'daily_login',
    action: '每日登录',
    reward: '11~50+',
    description: '基础 10 经验 + 连签加成 + 连签节点奖励',
  },
] as const

export type ExperienceRule = (typeof EXPERIENCE_RULES)[number]
export type ExperienceRuleId = ExperienceRule['id']

const LEADERBOARD_EXPERIENCE_RULE_IDS: readonly ExperienceRuleId[] = [
  'publish_project',
  'complete_project',
  'submit_observation',
  'complete_challenge',
]

export function getLeaderboardExperienceRules() {
  return LEADERBOARD_EXPERIENCE_RULE_IDS.map((id) => EXPERIENCE_RULES.find((rule) => rule.id === id)).filter(
    (rule): rule is ExperienceRule => Boolean(rule),
  )
}
