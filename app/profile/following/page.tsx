import { ProfileUserListPage } from '@/components/profile/profile-user-list-page'

export default function ProfileFollowingPage() {
  return (
    <ProfileUserListPage
      type="following"
      title="关注"
      emptyTitle="还没有关注任何人"
      emptyDescription="去社区或公开主页找到感兴趣的人，后续可以在这里统一查看。"
    />
  )
}
