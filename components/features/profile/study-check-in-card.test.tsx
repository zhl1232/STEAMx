import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StudyCheckInCard } from './study-check-in-card'

describe('StudyCheckInCard', () => {
  it('shows a preserved streak through yesterday when today is not completed', () => {
    render(
      <StudyCheckInCard
        title={<div>每日打卡</div>}
        state="ready"
        summary={{
          streak: 8,
          todayCompleted: false,
          streakThroughDate: '2026-05-06',
          days: [
            { date: '2026-05-02', label: '5.02', completed: true },
            { date: '2026-05-03', label: '5.03', completed: true },
            { date: '2026-05-04', label: '5.04', completed: true },
            { date: '2026-05-05', label: '5.05', completed: true },
            { date: '2026-05-06', label: '5.06', completed: true },
            { date: '2026-05-07', label: '5.07', completed: false },
          ],
        }}
      />,
    )

    expect(screen.getByText('连续打卡')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('今天还没完成')).toBeInTheDocument()
    expect(
      screen.getByText('今天登录、完成项目、提交观察或挑战作品，都能续上连续打卡。'),
    ).toBeInTheDocument()
  })

  it('shows a neutral fallback when data fails to load', () => {
    render(
      <StudyCheckInCard
        title={<div>每日打卡</div>}
        state="error"
        summary={null}
      />,
    )

    expect(screen.getByText('暂时不可用')).toBeInTheDocument()
    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText('暂时无法载入打卡记录，请稍后刷新重试。')).toBeInTheDocument()
  })
})
