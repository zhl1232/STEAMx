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
  })
})
