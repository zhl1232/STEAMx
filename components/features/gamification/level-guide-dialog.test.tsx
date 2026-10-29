import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { LevelGuideDialog } from './level-guide-dialog'
import { LEVEL_BENEFITS } from '@/lib/gamification/level-benefits'
import { SHOP_ITEMS } from '@/lib/shop/items'

const state = vi.hoisted(() => ({ level: 1, xp: 0, nextLevelXp: 100, progress: 0, levelProgress: 0, levelTotalNeeded: 100 }))
vi.mock('@/lib/context/gamification-context', () => ({ useGamification: () => state }))
beforeEach(() => Object.assign(state, { level: 1, xp: 0, nextLevelXp: 100, progress: 0, levelProgress: 0, levelTotalNeeded: 100 }))

it('includes every catalog item once at its actual unlock level', () => {
  const listed = LEVEL_BENEFITS.flatMap(tier => tier.benefits.filter(benefit => benefit.itemId).map(benefit => ({ id: benefit.itemId, level: tier.level })))
  expect(listed).toHaveLength(SHOP_ITEMS.length)
  for (const item of SHOP_ITEMS) {
    expect(listed.filter(entry => entry.id === item.id)).toEqual([{ id: item.id, level: Math.max(1, item.minLevel ?? 1) }])
  }
  expect(LEVEL_BENEFITS.find(tier => tier.level === 2)).toBeUndefined()
  expect(LEVEL_BENEFITS.find(tier => tier.level === 8)?.xp).toBe(4900)
})

it('shows Lv.8 as the next benefit after Lv.5 rather than skipping to Lv.10', async () => {
  Object.assign(state, { level: 5, xp: 1600, nextLevelXp: 2500, levelTotalNeeded: 900 })
  render(<LevelGuideDialog><button>查看规则</button></LevelGuideDialog>)
  await userEvent.click(screen.getByRole('button', { name: '查看规则' }))
  expect(screen.getByText('Lv.8')).toBeInTheDocument()
  expect(screen.getByText('3,300')).toBeInTheDocument()
})

it('distinguishes level eligibility from awarded benefits', async () => {
  render(<LevelGuideDialog defaultTab="levels"><button>查看规则</button></LevelGuideDialog>)
  await userEvent.click(screen.getByRole('button', { name: '查看规则' }))
  expect(screen.getByText('可用硬币兑换「像素边框」头像框')).toBeInTheDocument()
  expect(screen.getByText('可用硬币兑换「科学星轨」头像框')).toBeInTheDocument()
  expect(screen.getByText('等级已达标')).toBeInTheDocument()
  expect(screen.queryByText('已解锁')).not.toBeInTheDocument()
  expect(screen.getByText(/仍需综合评分达标/)).toBeInTheDocument()
  expect(screen.getByText(/不保证曝光或排名/)).toBeInTheDocument()
})

it('explains approval and claim requirements for XP', async () => {
  render(<LevelGuideDialog defaultTab="earn"><button>查看规则</button></LevelGuideDialog>)
  await userEvent.click(screen.getByRole('button', { name: '查看规则' }))
  expect(screen.getByText(/自然观察审核通过/)).toBeInTheDocument()
  expect(screen.getByText(/手动领取|领取后/)).toBeInTheDocument()
})
