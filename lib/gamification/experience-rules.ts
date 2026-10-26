export const EXPERIENCE_RULES = [
  {
    id: 'publish_project',
    action: '发布项目',
    reward: '+50',
    description: '分享你的创意作品',
  },
  {
    id: 'publish_course_work',
    action: '上传课时作品',
    reward: '最多 +200',
    description: '每课时首次真实过程 40、新观察/比较/调整 60、最终作品或总结 100，人工审核后各一次',
  },
  {
    id: 'complete_project',
    action: '完成项目',
    reward: '最多 +200',
    description: '每项目真实过程 40、新发现 60、作品或总结 100；失败也可总结，一份记录可涵盖多阶段',
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
    id: 'like_project',
    action: '点赞项目',
    reward: '不发 XP',
    description: '保留点赞数字，鼓励优秀作品',
  },
  {
    id: 'growth_exchange',
    action: '合格作品交流',
    reward: '+5',
    description: '人工确认真实问题、尝试、建议或回复他人；上海时间每天最多一次、每周四次，同作品每周一次；违规撤回',
  },
  {
    id: 'daily_login',
    action: '每日登录',
    reward: '+3',
    description: '每日自动登录固定 3 XP 和 2 硬币，不再增加连签或累计额外 XP',
  },
] as const

export type ExperienceRule = (typeof EXPERIENCE_RULES)[number]
export type ExperienceRuleId = ExperienceRule['id']

const LEADERBOARD_EXPERIENCE_RULE_IDS: readonly ExperienceRuleId[] = [
  'publish_course_work',
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
