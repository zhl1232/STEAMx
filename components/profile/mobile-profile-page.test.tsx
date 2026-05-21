import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MobileProfilePage } from './mobile-profile-page'
import type { Project } from '@/lib/mappers/types'

function makeProject(id: number, title: string): Project {
  return {
    id,
    title,
    image: '',
    author: 'test',
    author_id: 'user-1',
    category: '科学',
    likes: 0,
    views_count: 0,
  } as Project
}

const baseProps = {
  user: { id: 'user-1', user_metadata: {} } as never,
  profile: null,
  myProjects: [],
  myProjectsTotalCount: 0,
  totalLikesReceived: 0,
  likedProjectsList: [],
  collectedProjectsList: [],
  completedProjectsList: [],
  followerCount: 0,
  followingCount: 0,
  likedProjectsCount: 0,
  collectedProjectsCount: 0,
  completedProjectsCount: 0,
}

describe('MobileProfilePage', () => {
  it('shows a loading state instead of empty project states while profile data is still loading', () => {
    render(
      <MobileProfilePage
        {...baseProps}
        isProjectsDataLoading
      />
    )

    expect(screen.getByText('加载个人主页中...')).toBeInTheDocument()
    expect(screen.queryByText('暂无作品')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无收藏')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无喜欢')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无完成')).not.toBeInTheDocument()
  })

  it('opens the exploring tab from the initial tab prop', () => {
    render(
      <MobileProfilePage
        {...baseProps}
        initialTab="exploring"
        exploringProjectsList={[makeProject(42, '太阳能小车')]}
        showProfileHeader={false}
      />,
    )

    expect(screen.getByRole('link', { name: /太阳能小车/ })).toHaveAttribute('href', '/project/42/records')
    expect(screen.queryByText('暂无作品')).not.toBeInTheDocument()
  })
})
