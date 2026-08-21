import { render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { WeeklyPlan } from '@/lib/profile/weekly-plan'
import { WeeklyPlanCard } from './weekly-plan-card'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/features/profile/profile-spot-icons', () => ({
  ProfileSpotIcon: () => <span aria-hidden="true" />,
}))

const plan: WeeklyPlan = {
  title: '本周探索计划',
  subtitle: '这周进展不错，继续完成下一步吧。',
  weekStart: '2026-07-19T16:00:00.000Z',
  completedCount: 1,
  steps: [
    {
      id: 'done:project-1',
      type: 'project',
      status: 'done',
      title: '完成纸飞机挑战',
      subtitle: '纸飞机飞行实验',
      href: '/profile/timeline',
      actionLabel: '查看记录',
      badgeLabel: '已完成',
    },
    {
      id: 'todo:explore',
      type: 'explore',
      status: 'todo',
      title: '去发现新项目',
      subtitle: '找到下一个想动手完成的挑战。',
      href: '/explore',
      actionLabel: '去探索',
      badgeLabel: '推荐',
    },
  ],
}

describe('WeeklyPlanCard', () => {
  it('keeps completed steps visible with a quiet record link', () => {
    render(<WeeklyPlanCard plan={plan} />)

    expect(screen.getByText('完成纸飞机挑战')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看记录' })).toHaveAttribute(
      'href',
      '/profile/timeline',
    )
    expect(screen.getByRole('link', { name: '去探索' })).toHaveAttribute('href', '/explore')
    expect(screen.getByRole('link', { name: /查看完整成长足迹/ })).toHaveAttribute('href', '/profile/timeline')
    expect(screen.queryByText('全部轨迹')).not.toBeInTheDocument()
  })

  it('renders compact on mobile initially and displays bottom timeline link when expanded', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(<WeeklyPlanCard plan={plan} variant="mobile" />)

    // 默认折叠：只显示当前焦点步骤（未完成的“去发现新项目”），不显示底部链接
    expect(screen.getByText('清单 1/2')).toBeInTheDocument()
    expect(screen.getByText('去发现新项目')).toBeInTheDocument()
    expect(screen.queryByText('完成纸飞机挑战')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /查看完整成长足迹/ })).not.toBeInTheDocument()

    // 点击展开清单
    await user.click(screen.getByRole('button', { name: '展开任务清单' }))

    // 展开后：显示全部任务以及底部的成长足迹链接
    expect(screen.getByText('收起清单')).toBeInTheDocument()
    expect(screen.getByText('完成纸飞机挑战')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看完整成长足迹/ })).toHaveAttribute('href', '/profile/timeline')
  })
})
