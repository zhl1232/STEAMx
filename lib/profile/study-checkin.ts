export const STUDY_CHECKIN_WINDOW_DAYS = 6

export type StudyCheckInLoadState = 'loading' | 'ready' | 'error'

export type StudyCheckInDay = {
  date: string
  label: string
  completed: boolean
}

export type ProfileStudyCheckInSummary = {
  streak: number
  todayCompleted: boolean
  streakThroughDate: string | null
  days: StudyCheckInDay[]
}

export function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

export function getRecentDayLabels(count: number, referenceDate: Date = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(referenceDate)
    date.setDate(referenceDate.getDate() - (count - index - 1))
    return formatMonthDay(date)
  })
}

export function getPlaceholderStudyCheckInDays(count = STUDY_CHECKIN_WINDOW_DAYS): StudyCheckInDay[] {
  return getRecentDayLabels(count).map((label) => ({
    date: '',
    label,
    completed: false,
  }))
}

export function getStudyCheckInMetricValue(
  state: StudyCheckInLoadState,
  summary: ProfileStudyCheckInSummary | null,
) {
  if (state === 'loading') {
    return { value: '同步中', suffix: '' }
  }

  if (state === 'error' || !summary) {
    return { value: '--', suffix: '' }
  }

  return { value: String(summary.streak), suffix: '天' }
}

export function getStudyCheckInStatusText(
  state: StudyCheckInLoadState,
  summary: ProfileStudyCheckInSummary | null,
) {
  if (state === 'loading') return '正在同步'
  if (state === 'error' || !summary) return '暂时不可用'
  if (summary.todayCompleted) return '今天已完成'
  if (summary.streak > 0) return '今天还没完成'
  return '今天开始'
}

export function getStudyCheckInHint(
  state: StudyCheckInLoadState,
  summary: ProfileStudyCheckInSummary | null,
) {
  if (state === 'loading') {
    return '正在同步最近的打卡记录。'
  }

  if (state === 'error' || !summary) {
    return '暂时无法载入打卡记录，请稍后刷新重试。'
  }

  if (summary.todayCompleted) {
    return '今天已完成打卡，明天继续保持。'
  }

  if (summary.streak > 0) {
    return '今天登录、完成项目、提交观察或挑战作品，都能续上连续打卡。'
  }

  return '从今天开始，登录或完成 1 次项目、观察、挑战提交即可点亮第一天。'
}
