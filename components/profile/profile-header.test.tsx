import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ProfileHeader } from './profile-header'

vi.mock('@/lib/context/gamification-context', () => ({
  BADGES: [],
  useGamification: () => ({ unlockedBadges: new Set(), userBadgeDetails: [], coins: 0 }),
}))
vi.mock('@/lib/context/notification-context', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}))
vi.mock('@/components/features/gamification/badge-gallery-dialog', () => ({
  BadgeGalleryDialog: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/components/features/gamification/level-guide-dialog', () => ({
  LevelGuideDialog: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/components/features/profile/edit-profile-dialog', () => ({
  EditProfileDialog: ({ open, initialTarget, onOpenChange, onCloseAutoFocus }: {
    open: boolean
    initialTarget: string
    onOpenChange: (open: boolean) => void
    onCloseAutoFocus: (event: Event) => void
  }) => open ? (
    <div role="dialog" aria-label={`编辑 ${initialTarget}`}>
      <button onClick={() => {
        onOpenChange(false)
        onCloseAutoFocus(new Event('close'))
      }}>关闭编辑</button>
    </div>
  ) : null,
}))

function renderHeader() {
  return render(<ProfileHeader
    user={{ id: 'user-1', user_metadata: { full_name: '小探索家' } } as never}
    profile={null}
    myProjectsCount={0}
    totalLikesReceived={0}
    followerCount={0}
    followingCount={0}
  />)
}

describe('ProfileHeader editing entrypoints', () => {
  it.each([
    ['更换头像', 'avatar'],
    ['修改昵称：小探索家', 'display_name'],
    ['编辑资料', 'overview'],
  ])('opens the matching editor from %s and restores focus', (name, target) => {
    renderHeader()
    const trigger = screen.getByRole('button', { name })
    fireEvent.click(trigger)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('dialog', { name: `编辑 ${target}` })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭编辑' }))
    expect(trigger).toHaveFocus()
  })

  it('keeps a separate public profile link without nesting it in the avatar button', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: '查看公开主页' })).toHaveAttribute('href', '/users/user-1')
    expect(screen.getByRole('button', { name: '更换头像' }).querySelector('a')).toBeNull()
  })
})
