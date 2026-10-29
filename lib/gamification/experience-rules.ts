export const EXPERIENCE_RULES = [
  {
    id: 'publish_project',
    action: '发布项目',
    reward: '+50',
    description: '首次发布项目获得，每个项目一次',
  },
  {
    id: 'publish_course_work',
    action: '上传课时作品',
    reward: '最多 +200',
    description: '每课时首次真实过程 40、新观察/比较/调整 60、最终作品或总结 100，独立内容证据审核后各一次',
  },
  {
    id: 'complete_project',
    action: '完成项目',
    reward: '最多 +200',
    description: '每项目真实过程 40、新发现 60、作品或总结 100，独立内容证据审核后各一次；失败也可总结，一份记录可涵盖多阶段',
  },
  {
    id: 'submit_observation',
    action: '自然观察审核通过',
    reward: '+10',
    description: '记录通过审核后获得，提交本身不发放',
  },
  {
    id: 'join_challenge',
    action: '参加挑战',
    reward: '+10',
    description: '首次报名参与主题挑战获得，每个挑战一次',
  },
  {
    id: 'complete_challenge',
    action: '完成挑战',
    reward: '+20～30',
    description: '普通挑战作品审核通过 +20；长期挑战关联项目审核通过并完成挑战后 +20，含反思及至少一次迭代再 +10；限时挑战合格公开作品结算 +20，各类型按对应路径发放',
  },
  {
    id: 'starter_tasks',
    action: '完成新手任务',
    reward: '+10～30',
    description: '开始实践 +10、完成实践 +20、保存作品或记录 +30；补充任务各 +10。达成后手动领取，每项一次',
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
    description: '项目问答与作品交流经审核符合条件后共享每天最多5次、同一线程每天一次（上海时间），无周上限；违规撤回',
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
