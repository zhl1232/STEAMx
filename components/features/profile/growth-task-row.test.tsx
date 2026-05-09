import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import type { AnchorHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { GrowthTaskRow } from './growth-task-row'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const baseTask = {
  id: 'publish_first_project' as const,
  label: '发布 1 个项目',
  href: '/share',
  rewardXp: 20,
  reward: '+20 经验',
  target: 1,
  currentValue: 1,
  progressLabel: '1/1',
  progress: 100,
  done: true,
  claimed: false,
  claimable: true,
  status: 'claimable' as const,
}

describe('GrowthTaskRow', () => {
  it('renders a claim button for claimable rewards', async () => {
    const onClaim = vi.fn()
    const user = userEvent.setup()

    render(<GrowthTaskRow task={baseTask} onClaim={onClaim} />)

    await user.click(screen.getByRole('button', { name: '领取' }))

    expect(onClaim).toHaveBeenCalledWith('publish_first_project')
  })

  it('renders progress text for in-progress tasks', () => {
    render(
      <GrowthTaskRow
        task={{
          ...baseTask,
          id: 'explore_three_days',
          label: '连续探索 3 天',
          rewardXp: 20,
          reward: '+20 经验',
          target: 3,
          currentValue: 2,
          progressLabel: '2/3',
          progress: 67,
          done: false,
          claimable: false,
          claimed: false,
          status: 'in_progress',
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: '领取' })).not.toBeInTheDocument()
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('renders claimed state without an action button', () => {
    render(
      <GrowthTaskRow
        task={{
          ...baseTask,
          claimed: true,
          claimable: false,
          status: 'claimed',
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: '领取' })).not.toBeInTheDocument()
    expect(screen.getByText('已领取')).toBeInTheDocument()
  })
})
