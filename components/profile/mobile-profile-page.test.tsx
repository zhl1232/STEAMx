import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MobileProfilePage } from './mobile-profile-page'

describe('MobileProfilePage', () => {
  it('shows a loading state instead of empty project states while profile data is still loading', () => {
    render(
      <MobileProfilePage
        user={{ id: 'user-1', user_metadata: {} } as never}
        profile={null}
        myProjects={[]}
        likedProjectsList={[]}
        collectedProjectsList={[]}
        completedProjectsList={[]}
        followerCount={0}
        followingCount={0}
        isProjectsDataLoading
      />
    )

    expect(screen.getByText('加载个人主页中...')).toBeInTheDocument()
    expect(screen.queryByText('暂无作品')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无收藏')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无喜欢')).not.toBeInTheDocument()
    expect(screen.queryByText('暂无完成')).not.toBeInTheDocument()
  })
})
