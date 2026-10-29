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
  title: '继续探索',
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
  it.each(['default', 'mobile'] as const)('shows one next action and expands history on %s', async (variant) => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<WeeklyPlanCard plan={plan} variant={variant} />)

    expect(screen.getByText('去发现新项目')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '去探索' })).toHaveAttribute('href', '/explore')
    expect(screen.queryByText('完成纸飞机挑战')).not.toBeInTheDocument()
    expect(screen.queryByText('1/2')).not.toBeInTheDocument()
    const expand = screen.getByRole('button', { name: '展开更多探索建议' })
    expect(expand).toHaveAttribute('aria-expanded', 'false')

    await user.click(expand)

    expect(screen.getByText('完成纸飞机挑战')).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看记录' })).toHaveAttribute('href', '/profile/timeline')
    expect(screen.getByRole('link', { name: /查看完整成长足迹/ })).toHaveAttribute('href', '/profile/timeline')
    const collapse = screen.getByRole('button', { name: '收起探索建议' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')

    await user.click(collapse)
    expect(screen.queryByText('完成纸飞机挑战')).not.toBeInTheDocument()
  })

  it('prioritizes a claimable reward and preserves pending claim behavior', async () => {
    const { userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    const onClaim = vi.fn()
    const rewardPlan: WeeklyPlan = {
      ...plan,
      steps: [...plan.steps, {
        id: 'reward:profile',
        type: 'reward',
        status: 'todo',
        title: '完善资料奖励',
        subtitle: '领取探索经验',
        href: '/profile',
        actionLabel: '领取奖励',
        badgeLabel: '可领取',
        growthTaskId: 'write_bio',
      }],
    }
    const { rerender } = render(<WeeklyPlanCard plan={rewardPlan} onClaim={onClaim} />)
    expect(screen.getByText('完善资料奖励')).toBeInTheDocument()
    expect(screen.queryByText('去发现新项目')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '领取奖励' }))
    expect(onClaim).toHaveBeenCalledWith('write_bio')

    rerender(<WeeklyPlanCard plan={rewardPlan} onClaim={onClaim} claimPendingTaskId="write_bio" />)
    expect(screen.getByRole('button', { name: '领取中' })).toBeDisabled()
  })
})
