import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AnchorHTMLAttributes } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GrowthTasksGraduatedCard, scrollToProfileBadges } from '@/components/features/profile/growth-tasks-graduated-card'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

function makeClaimedTask(id: GrowthTaskId, label: string, rewardXp: number): ProfileGrowthTask {
  return {
    id,
    label,
    href: '/profile',
    rewardXp,
    reward: `+${rewardXp} 经验`,
    target: 1,
    currentValue: 1,
    progressLabel: '1/1',
    progress: 100,
    done: true,
    claimed: true,
    claimable: false,
    status: 'claimed',
  }
}

const SAMPLE_TASKS: ProfileGrowthTask[] = [
  makeClaimedTask('write_bio', '写一句自我介绍', 10),
  makeClaimedTask('publish_first_project', '发布 1 个项目', 20),
  makeClaimedTask('complete_first_project', '完成 1 个项目', 20),
  makeClaimedTask('submit_first_observation', '记录 1 条自然观察', 10),
  {
    ...makeClaimedTask('explore_three_days', '连续探索 3 天', 20),
    target: 3,
    progressLabel: '3/3',
  },
]

describe('GrowthTasksGraduatedCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(window.Element.prototype, 'scrollIntoView').mockImplementation(() => {})
  })

  it('toggles history and scrolls to badges anchor', async () => {
    const user = userEvent.setup()
    const onClaim = vi.fn()

    render(
      <div>
        <div id="profile-badges-anchor">badges</div>
        <GrowthTasksGraduatedCard
          tasks={SAMPLE_TASKS}
          showSparkle={false}
          claimingTaskId={null}
          onClaim={onClaim}
        />
      </div>,
    )

    expect(screen.getByText('成长任务 · 已全部完成')).toBeInTheDocument()
    expect(screen.getByText(/累计 \+80 经验/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看完成记录' }))
    expect(screen.getByText('写一句自我介绍')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看徽章' }))
    expect(window.Element.prototype.scrollIntoView).toHaveBeenCalled()

    scrollToProfileBadges()
    expect(window.Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('links to challenges', () => {
    render(
      <GrowthTasksGraduatedCard tasks={SAMPLE_TASKS} showSparkle={false} claimingTaskId={null} onClaim={vi.fn()} />,
    )
    expect(screen.getByRole('link', { name: '去挑战' })).toHaveAttribute('href', '/create')
  })
})
